/**
 * Whitelist of common tools that Claude Code frequently uses
 * This provides good coverage while keeping shim creation fast.
 */
export const CLAUDE_TOOLS_WHITELIST = [
  // Version control
  'gh',
  'svn',
  'hg',
  'bzr',

  // Node.js ecosystem
  'npx',
  'yarn',
  'pnpm',

  // Python ecosystem
  'python',
  'python3',
  'pip',
  'pip3',
  'poetry',
  'pipenv',
  'uv',

  // Package managers and build tools
  'cargo',
  'rustc',
  'go',
  'java',
  'javac',
  'gradle',
  'maven',
  'mvn',
  'gcc',
  'g++',
  'clang',
  'clang++',
  'make',
  'cmake',
  'ninja',

  // Web and API tools
  'curl',
  'wget',
  'http',
  'httpie',

  // Container and deployment tools
  'docker',
  'docker-compose',
  'kubectl',
  'helm',
  'terraform',
  'ansible',

  // File operations
  'tar',
  'gzip',
  'gunzip',
  'zip',
  'unzip',
  'rsync',
  'scp',
  'cp',
  'mv',
  'rm',
  'mkdir',
  'rmdir',

  // Text processing
  'cat',
  'less',
  'more',
  'wc',
  'rg',

  // System information
  'ls',
  'find',
  'which',
  'whereis',
  'du',
  'df',
  'free',
  'uptime',

  // Network tools
  'ping',
  'netstat',
  'nslookup',
  'dig',
  'traceroute',
  'telnet',
  'nc',
  'nmap',

  // Database tools
  'mysql',
  'psql',
  'sqlite3',
  'mongo',
  'redis-cli',

  // Development tools
  'vim',
  'nano',
  'emacs',
  'code',
  'subl',
  'atom',
  'jq',
  'yq',
  'xmllint',
  'openssl',

  // Cloud CLI tools
  'aws',
  'gcloud',
  'az',
  'heroku',
  'vercel',
  'netlify',

  // Testing and linting
  'jest',
  'mocha',
  'pytest',
  'phpunit',
  'rspec',
  'eslint',
  'prettier',
  'black',
  'flake8',
  'mypy',
  'tsc',
  'clippy',

  // Shell utilities
  'env',
  'export',
  'echo',
  'printf',
  'sleep',
  'date',
  'cal',

  // Process management
  'pgrep',
  'nohup',
  'screen',
  'tmux',

  // File permissions and ownership
  'chmod',
  'chown',
  'chgrp',
  'umask',

  // Archive and compression
  'tar',
  'gzip',
  'gunzip',
  'bzip2',
  'bunzip2',
  'xz',
  'unxz',
  '7z',

  // Package managers (system level)
  'brew',
  'port',

  // System monitoring
  'iotop',
  'vmstat',
  'iostat',
  'sar',

  // SSH and remote access
  'scp',
  'sftp',
  'ssh-keygen',
  'ssh-agent',
  'ssh-add',
];
