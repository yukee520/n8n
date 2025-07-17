import { CredentialsRepository } from '@n8n/db';
import { Container } from '@n8n/di';
import type {
	IDataObject,
	INodeCredentialsDetails,
	IRun,
	ITaskData,
	IWorkflowBase,
} from 'n8n-workflow';
import { v4 as uuid } from 'uuid';
import { VariablesService } from '@/environments.ee/variables/variables.service.ee';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Return data of last executed node
export function getDataLastExecutedNodeData(inputData: IRun): ITaskData | undefined {
	const { runData, pinData = {}, lastNodeExecuted } = inputData.data.resultData;

	if (!lastNodeExecuted || !runData[lastNodeExecuted]) return undefined;

	const lastNodeRunData = runData[lastNodeExecuted][runData[lastNodeExecuted].length - 1];
	let lastNodePinData = pinData[lastNodeExecuted];

	if (lastNodePinData && inputData.mode === 'manual') {
		if (!Array.isArray(lastNodePinData)) lastNodePinData = [lastNodePinData];

		const itemsPerRun = lastNodePinData.map((item, index) => ({
			json: item,
			pairedItem: { item: index },
		}));

		return {
			startTime: 0,
			executionIndex: 0,
			executionTime: 0,
			data: { main: [itemsPerRun] },
			source: lastNodeRunData.source,
		};
	}

	return lastNodeRunData;
}

// Assign UUID to nodes without an ID
export function addNodeIds(workflow: IWorkflowBase) {
	workflow.nodes?.forEach((node) => {
		if (!node.id) {
			node.id = uuid();
		}
	});
}

// Replace deprecated or missing credentials
export async function replaceInvalidCredentials<T extends IWorkflowBase>(workflow: T): Promise<T> {
	const { nodes } = workflow;
	if (!nodes) return workflow;

	const credentialsByName: Record<string, Record<string, INodeCredentialsDetails>> = {};
	const credentialsById: Record<string, Record<string, INodeCredentialsDetails>> = {};

	for (const node of nodes) {
		if (!node.credentials || node.disabled) continue;

		for (const [type, credential] of Object.entries(node.credentials)) {
			// Handle name-based credentials
			if (typeof credential === 'string' || credential.id === null) {
				const name = typeof credential === 'string' ? credential : credential.name;

				credentialsByName[type] ??= {};

				if (!credentialsByName[type][name]) {
					const matches = await Container.get(CredentialsRepository).findBy({ name, type });
					credentialsByName[type][name] = matches?.[0]
						? { id: matches[0].id, name: matches[0].name }
						: { id: null, name };
				}

				node.credentials[type] = credentialsByName[type][name];
			} else {
				credentialsById[type] ??= {};

				if (!credentialsById[type][credential.id]) {
					const match = await Container.get(CredentialsRepository).findOneBy({
						id: credential.id,
						type,
					});

					if (match) {
						credentialsById[type][credential.id] = { id: match.id, name: match.name };
					} else {
						const byName = await Container.get(CredentialsRepository).findBy({
							name: credential.name,
							type,
						});
						if (byName?.length === 1) {
							credentialsById[type][byName[0].id] = {
								id: byName[0].id,
								name: byName[0].name,
							};
						} else {
							credentialsById[type][credential.id] = credential;
						}
					}
				}

				node.credentials[type] = credentialsById[type][credential.id];
			}
		}
	}

	return workflow;
}

// Load cached variables (if using n8n enterprise envs)
export async function getVariables(): Promise<IDataObject> {
	const variables = await Container.get(VariablesService).getAllCached();
	return Object.freeze(
		variables.reduce((acc, curr) => {
			acc[curr.key] = curr.value;
			return acc;
		}, {} as IDataObject)
	);
}
