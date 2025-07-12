module.exports = {
  supabaseApi: {
    credentialTest: {
      request: {
        method: 'POST',
        url: '={{$credentials.url}}/auth/v1/token',
        headers: { 'apikey': '={{$credentials.key}' }
      }
    },
    operations: {
      insert: {
        request: {
          method: 'POST',
          url: '={{$credentials.url}}/rest/v1/{{$parameter.table}}',
          headers: { 
            'apikey': '={{$credentials.key}',
            'Authorization': 'Bearer ={{$credentials.key}'
          }
        }
      }
    }
  }
}
