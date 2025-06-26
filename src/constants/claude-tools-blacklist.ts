  // Executables to exclude from shimming for safety.
  export const EXCLUDED_EXECUTABLES = new Set([
    // System critical
    'init',
    'kernel',
    'kthreadd',
    'systemd',
    'systemctl',
    // Shell and core utilities (to avoid infinite loops)
    'sh',
    'bash',
    'zsh',
    'fish',
    'dash',
    'csh',
    'tcsh',
    // Core system commands that could break the system
    'sudo',
    'su',
    'passwd',
    'mount',
    'umount',
    'fsck',
    'fdisk',
    'mkfs',
    'parted',
    'lvm',
    'cryptsetup',
    // Process and system management
    'kill',
    'killall',
    'pkill',
    'ps',
    'top',
    'htop',
    // Network and security critical
    'iptables',
    'firewalld',
    'ufw',
    'ssh',
    'sshd',
    // Package managers (could cause system issues)
    'apt',
    'apt-get',
    'yum',
    'dnf',
    'pacman',
    'zypper',
    // Our own tools (to avoid infinite recursion)
    'claudx',
    'claudx-shim',
    // Node.js process (to avoid shimming ourselves)
    'node',
    'npm',
    'bun', // We'll handle these specially if needed
    // Git operations (We use this to find the git root for config, so this prevents infinite loop)
    'git',
    // Core file operations that can cause infinite loops
    'cat',
    'ls',
    'find',
    'which',
    'whereis',
    // Noisy claude invocations (claude likes to use these behind the scenes and they're not very useful to track)
    'tail',
    'head',
    'sort',
    'uniq',
    'base64',
    'sed',
    'grep',
    'awk',
    'uname',
    'tr',
  ]);