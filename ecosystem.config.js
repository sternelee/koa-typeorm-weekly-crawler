module.exports = {
  apps : [{
    name: 'wechat',
    script: 'ts-node',
    args: './src/app.ts',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production'
    }
  }]
};
