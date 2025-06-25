#!/bin/bash
# claudx Uninstaller
# This script removes claudx installation and restores the original claude setup

set -e

INSTALL_DIR="$HOME/.claudx"

echo "🧹 claudx Uninstaller"
echo "=================================="
echo ""

# Remove claudx PATH entry from shell configs
remove_from_shell_configs() {
    echo "🔧 Removing claudx from shell configurations..."
    
    local shell_configs=(
        "$HOME/.zshrc"
        "$HOME/.bashrc" 
        "$HOME/.config/fish/config.fish"
        "$HOME/.profile"
    )
    
    for config in "${shell_configs[@]}"; do
        if [ -f "$config" ] && grep -q "claudx" "$config" 2>/dev/null; then
            # Create backup
            cp "$config" "${config}.claudx-backup"
            
            # Remove claudx-related lines
            grep -v "claudx\|claudx" "$config" > "${config}.tmp" && mv "${config}.tmp" "$config"
            echo "✅ Removed claudx from $config (backup created at ${config}.claudx-backup)"
        fi
    done
}

# Uninstall existing installation
uninstall_existing() {
    echo "🧹 Removing claudx installation..."
    if [ -d "$INSTALL_DIR" ]; then
        rm -rf "$INSTALL_DIR"
        echo "✅ Removed installation directory: $INSTALL_DIR"
    else
        echo "✅ No installation directory found"
    fi
}

# Main uninstall process
main() {
    echo "⚠️  This will completely remove claudx from your system."
    echo "Your original claude installation will remain untouched."
    echo ""
    read -p "Continue with uninstall? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Uninstall cancelled"
        exit 0
    fi
    
    remove_from_shell_configs
    uninstall_existing
    
    echo ""
    echo "🎉 Uninstall completed successfully!"
    echo ""
    echo "💡 Next steps:"
    echo "   1. Restart your shell to apply PATH changes"
    echo "   2. Your original claude command should work normally"
    echo ""
    echo "📝 Note: Shell config backups were created with .claudx-backup extension"
    echo "🔒 Your original claude installation was never modified and remains intact"
}

# Run the uninstaller
main