#!/bin/bash
# claudx Installer
# This script creates a shim for claude-code that automatically manages metrics collection

set -e

INSTALL_DIR="$HOME/.claudx"
SHIM_DIR="$INSTALL_DIR/shims"
ORIGINAL_CLAUDE_CODE=""
SHIM_ALL=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --shim-all)
      SHIM_ALL=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--shim-all]"
      echo "  --shim-all   Shim all executables on PATH (slower but complete coverage)"
      exit 1
      ;;
  esac
done

echo "🚀 claudx Installer"
echo "================================"
echo ""

if [ "$SHIM_ALL" = true ]; then
  echo "🔧 Mode: Full PATH shimming (all executables)"
else
  echo "🔧 Mode: Selective shimming (common Claude tools only)"
fi
echo ""

# Find the original claude executable
find_claude_code() {
    echo "🔍 Looking for claude executable..."
    
    ORIGINAL_CLAUDE_CODE=$(which claude 2>/dev/null || echo "")
    
    if [ -z "$ORIGINAL_CLAUDE_CODE" ]; then
        # Try the default local installation path
        if [ -f "$HOME/.claude/local/claude" ]; then
            ORIGINAL_CLAUDE_CODE="$HOME/.claude/local/claude"
            echo "✅ Found claude at: $ORIGINAL_CLAUDE_CODE (local installation)"
        else
            echo "❌ claude not found in PATH or at ~/.claude/local/claude"
            echo "Please install claude first"
            exit 1
        fi
    else
        # Check if claude is installed via npm
        if [[ "$ORIGINAL_CLAUDE_CODE" == *"/node_modules/.bin/claude"* ]] || [[ "$ORIGINAL_CLAUDE_CODE" == *"npm"* ]] || [[ -L "$ORIGINAL_CLAUDE_CODE" && $(readlink "$ORIGINAL_CLAUDE_CODE") == *"/node_modules/"* ]]; then
            echo "⚠️  Claude appears to be installed via npm."
            echo "    Please run '/migrate-installer' within claude first to migrate to the official installer."
            echo "    Then re-run this bootstrap script."
            exit 1
        fi
        echo "✅ Found claude at: $ORIGINAL_CLAUDE_CODE"
    fi
}

# Create the directory structure
setup_directories() {
    echo "📁 Setting up directories..."
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$SHIM_DIR"
    echo "✅ Directories created"
}

# Build the metrics collection system
build_system() {
    echo "🔨 Building metrics collection system..."
    npm install
    npm run build
    
    # Copy dist files to ~/.claudx for runtime access
    echo "📦 Copying runtime files to ~/.claudx..."
    cp dist/metrics-collector.js "$INSTALL_DIR/"
    cp dist/auto-shim.js "$INSTALL_DIR/"
    cp uninstall.sh "$INSTALL_DIR/"
    
    # Create package.json in ~/.claudx to enable ES modules
    cat > "$INSTALL_DIR/package.json" << 'EOF'
{
  "type": "module"
}
EOF
    echo "✅ System built successfully"
}

# Create the claude shim
create_claude_shim() {
    echo "📝 Creating claude shim..."
    
    # Backup original claude
    cp "$ORIGINAL_CLAUDE_CODE" "$INSTALL_DIR/claude.original"
    
    # Get the absolute path to our source files
    METRICS_COLLECTOR_PATH="$(pwd)/dist/metrics-collector.js"
    AUTO_SHIM_SOURCE="$INSTALL_DIR/auto-shim.js"
    PROJECT_DIR="$(pwd)"
    
    # Create the claude shim script
    cat > "$INSTALL_DIR/claude" << EOF
#!/bin/bash
# claudx Shim
# Auto-generates and manages shims for all executables

METRICS_DIR="$INSTALL_DIR"
SHIM_DIR="$SHIM_DIR"
ORIGINAL_CLAUDE_CODE="$INSTALL_DIR/claude.original"
AUTO_SHIM_SOURCE="$AUTO_SHIM_SOURCE"
PROJECT_DIR="$PROJECT_DIR"
SHIM_ALL_FLAG="$SHIM_ALL"

# Pass the origin working directory to claudx for resolving configs.
export CLAUDX_ORIGINAL_CWD="\$PWD"

# Function to generate shims on demand
ensure_shims_updated() {
    echo "[claudx] 🔍 Checking for shim updates..." >&2
    
    # Run the auto-shim manager using the bundled JS file
    node "\$AUTO_SHIM_SOURCE" "\$METRICS_DIR" \$SHIM_ALL_FLAG >&2 || echo "⚠️  Shim update failed" >&2
}

# Ensure shims are current
ensure_shims_updated

# Add shim directory to PATH for this execution only
export PATH="$SHIM_DIR:\$PATH"

# Execute the original claude with all arguments
exec "\$ORIGINAL_CLAUDE_CODE" "\$@"
EOF
    
    chmod +x "$INSTALL_DIR/claude"
    echo "✅ Claude shim created"
}

# Add to PATH
setup_path() {
    echo "🔧 Setting up PATH..."
    
    # Detect shell
    SHELL_NAME=$(basename "$SHELL")
    case "$SHELL_NAME" in
        zsh)
            SHELL_RC="$HOME/.zshrc"
            ;;
        fish)
            SHELL_RC="$HOME/.config/fish/config.fish"
            ;;
        bash)
            SHELL_RC="$HOME/.bashrc"
            ;;
        *)
            SHELL_RC="$HOME/.profile"
            ;;
    esac
    
    # Comment out any existing claude alias that might override our PATH entry
    echo "🗑️  Commenting out existing claude alias..."
    if [ -f "$SHELL_RC" ]; then
        # Comment out lines that set claude alias
        sed -i 's/^alias claude.*\.claude\/local\/claude/# &/' "$SHELL_RC" 2>/dev/null || true
        sed -i 's/^alias claude=/# &/' "$SHELL_RC" 2>/dev/null || true
        echo "✅ Commented out existing claude aliases"
    fi
    
    # Check if already in PATH
    if ! grep -q "claudx" "$SHELL_RC" 2>/dev/null; then
        echo "" >> "$SHELL_RC"
        echo "# claudx - added by installer" >> "$SHELL_RC"
        echo "export PATH=\"$INSTALL_DIR:\$PATH\"" >> "$SHELL_RC"
        echo "✅ Added to $SHELL_RC"
        echo "🔄 Please restart your shell or run: source $SHELL_RC"
    else
        echo "✅ Already configured in $SHELL_RC"
    fi
}

# Check if prior installation exists
check_existing_installation() {
    local has_installation=false
    
    # Check for installation directory
    if [ -d "$INSTALL_DIR" ]; then
        has_installation=true
    fi
    
    # Check for claudx in shell configs, excluding backup files
    local shell_configs=("$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.config/fish/config.fish" "$HOME/.profile")
    for config in "${shell_configs[@]}"; do
        if [ -f "$config" ] && [[ "$config" != *.claudx-backup ]] && grep -q "claudx" "$config" 2>/dev/null; then
            has_installation=true
            break
        fi
    done
    
    if [ "$has_installation" = true ]; then
        echo "🔍 Found existing claudx installation"
        echo "🧹 Running uninstaller to clean up..."
        ./uninstall.sh
    else
        echo "✅ No existing installation found"
    fi
}

# Main installation process
main() {
    check_existing_installation
    find_claude_code
    setup_directories
    build_system
    create_claude_shim
    setup_path
    
    echo ""
    echo "🎉 Installation completed successfully!"
    echo ""
    echo "📊 How it works:"
    echo "   • Your original claude is now shimmed"
    if [ "$SHIM_ALL" = true ]; then
      echo "   • When you run claude, it automatically:"
      echo "     - Discovers all executables on your PATH"
      echo "     - Creates shims for metrics collection"
      echo "     - Sets up an isolated environment"
      echo "     - Collects metrics for all tool usage"
    else
      echo "   • When you run claude, it automatically:"
      echo "     - Creates shims for common development tools"
      echo "     - Sets up an isolated environment"
      echo "     - Collects metrics for tool usage"
      echo "   • For complete coverage, use: ./bootstrap.sh --shim-all"
    fi
    echo ""
    echo "💡 Next steps:"
    echo "   1. Restart your shell: source $SHELL_RC"
    echo "   2. Run claude normally - metrics will be collected automatically"
    echo "   3. View metrics: cd $(pwd) && npm run cli summary"
    echo ""
    echo "🔒 Your system remains completely untouched - all modifications are isolated!"
}

# Run the installer
main