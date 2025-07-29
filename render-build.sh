#!/bin/bash
# Remove all problematic dependency declarations
sed -i 's/"workspace:\*"/"*"/g' package.json
sed -i 's/"catalog:.*"/"*"/g' package.json
sed -i 's/"npm:.*"/"*"/g' package.json

# Install dependencies
npm install --production
