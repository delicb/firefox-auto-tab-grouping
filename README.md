# Auto Tab Grouper Firefox Extension

A Firefox extension that automatically organizes tabs into groups based on URL patterns. This extension monitors tab activity and groups tabs by their domain or specific URL paths, making it easier to organize your browsing sessions.

## Features

- **Automatic Tab Grouping**: Automatically groups tabs by URL patterns
- **Dual Pattern Types**: 
  - **Simple patterns**: hostname or hostname/path matching (e.g., `github.com`, `github.com/microsoft`)
  - **Regular expressions**: Advanced pattern matching (e.g., `.*\.google\.com.*`, `.*(docs|documentation).*`)
- **Pinned Tabs Control**: Option to include or ignore pinned tabs in grouping (default: ignore pinned tabs)
- **Customizable Group Names**: Configure custom names for each URL pattern group
- **Color-Coded Groups**: Choose from 8 different colors for visual organization
- **Real-time Organization**: Tabs are grouped instantly when navigating to configured patterns
- **Smart Management**: Automatically creates groups when needed and removes empty groups
- **Enable/Disable Toggle**: Easily turn auto-grouping on or off
- **Bulk Operations**: Regroup all tabs or ungroup all tabs with one click
- **In-Popup Notifications**: User-friendly notifications for success, warnings, and errors (no blocking alerts)
- **Confirmation Dialogs**: Safe removal with custom confirmation modals
- **Pattern Validation**: Real-time validation for both simple and regex patterns

## Installation

### Temporary Installation for Development

1. Open Firefox and navigate to `about:debugging`
2. Click on "This Firefox" in the left sidebar
3. Click on "Load Temporary Add-on..."
4. Select any file from the extension directory (e.g., manifest.json)

### Permanent Installation

To install this extension permanently:

1. Package the extension files into a ZIP file
2. Rename the ZIP file with a .xpi extension
3. Submit the extension to Mozilla Add-ons for review

## Usage

1. **Install the Extension**: Follow the installation steps below
2. **Open Settings**: Click on the extension icon in the toolbar to open the settings popup
3. **Configure Settings**:
   - **Auto-grouping toggle**: Enable or disable automatic tab grouping
   - **Pinned tabs toggle**: Choose whether to include pinned tabs in grouping (default: ignore pinned tabs)
4. **Configure Groups**: 
   - In the "Groups" section, enter a group name (e.g., "Development", "Social Media")
   - Choose a color from the 8 available options
   - Click "Add Group"
5. **Configure Rules**:
   - In the "Pattern Rules" section, choose your pattern type:
     - **Simple**: For basic domain/path matching (e.g., `github.com`, `github.com/microsoft`)
     - **Regular Expression**: For advanced pattern matching (e.g., `.*\.google\.com.*`, `.*(docs|documentation).*`)
   - Enter your URL pattern according to the selected type
   - Select which group to assign tabs matching this pattern
   - Click "Add Rule"
6. **Automatic Grouping**: When you visit a configured pattern:
   - The tab will automatically be moved to the corresponding group
   - If the group doesn't exist in the browser, it will be created with your chosen name and color
   - Tabs from unconfigured patterns will be ungrouped
   - Pinned tabs are ignored by default (can be changed in settings)
7. **Manage Configuration**: 
   - Remove groups or rules using the "Remove" buttons
   - Use control buttons to regroup all tabs, ungroup all tabs, or toggle auto-grouping
8. **Visual Feedback**: The extension provides notifications for all actions (success, warnings, errors)

### Pattern Types

The extension supports two types of URL pattern matching:

#### Simple Patterns
- **Domain only**: `github.com` - matches all GitHub pages
- **Domain with path**: `github.com/microsoft` - matches only Microsoft's GitHub pages
- **Subdomain support**: Enter the full subdomain like `docs.github.com`

Examples:
- `youtube.com` → matches youtube.com, www.youtube.com
- `reddit.com/r/programming` → matches only the programming subreddit
- `stackoverflow.com` → matches all Stack Overflow pages

#### Regular Expression Patterns
- **Advanced matching**: Use full regex syntax for complex patterns
- **Multiple domains**: `.*\.(google|gmail)\.com.*` - matches Google and Gmail
- **Flexible patterns**: `.*(docs|documentation).*` - matches any URL with "docs" or "documentation"
- **Subdomain wildcards**: `.*\.github\.com.*` - matches all GitHub subdomains

Examples:
- `.*\.google\.com.*` → matches docs.google.com, drive.google.com, etc.
- `https://.*\.(gov|edu).*` → matches government and education sites
- `.*(docs|documentation|manual).*` → matches documentation sites
- `.*reddit\.com/r/(programming|webdev).*` → matches specific subreddits

### Available Colors

The extension supports 8 predefined colors for tab groups:
- **Blue** (`blue`) - Default professional color
- **Red** (`red`) - For urgent or important sites
- **Yellow** (`yellow`) - For attention-requiring sites
- **Green** (`green`) - For productivity or safe sites
- **Pink** (`pink`) - For personal or creative sites
- **Purple** (`purple`) - For entertainment or social sites
- **Cyan** (`cyan`) - For development or technical sites
- **Orange** (`orange`) - For work or business sites

## Tab Groups in Firefox

This extension utilizes Firefox's built-in tab groups feature. Tab groups allow you to organize your tabs into color-coded collections that can be collapsed or expanded as needed, helping to reduce clutter in your tab bar.

## File Structure

```
firefox-auto-tab-organizer/
├── manifest.json              # Extension manifest with permissions and metadata
├── background.js              # Background script managing tab grouping logic
├── popup.html                 # Settings popup HTML interface
├── popup.js                   # Settings popup JavaScript functionality
├── tab-group-icon.svg         # Source SVG icon for the extension
├── icons/                     # Generated PNG icons in multiple resolutions
│   ├── icon16.png            # 16x16 - Browser UI elements
│   ├── icon32.png            # 32x32 - Firefox toolbar
│   ├── icon48.png            # 48x48 - Extension management
│   └── icon128.png           # 128x128 - Store listings and high DPI
├── icons-old/                 # Backup of previous icons
└── README.md                  # This documentation file
```

## How It Works

The extension uses Firefox's native tab groups API to:

1. **Monitor Tab Activity**: Listens for tab creation, URL changes, and tab activation
2. **Extract Hostnames**: Automatically extracts the hostname from tab URLs (removes www. prefix)
3. **Apply Configurations**: Matches hostnames against user-configured rules
4. **Manage Groups**: Creates groups with custom names and colors, or ungroups tabs as needed
5. **Persist Settings**: Saves all configurations using Firefox's storage API

## Icon Generation

The extension icons were generated using the following process:

1. **Source Design**: Created `tab-group-icon.svg` with visual representation of tab grouping
2. **PNG Generation**: Used `rsvg-convert` to generate PNG files in multiple resolutions:
   ```fish
   rsvg-convert -w 16 -h 16 -o icons/icon16.png tab-group-icon.svg
   rsvg-convert -w 32 -h 32 -o icons/icon32.png tab-group-icon.svg
   rsvg-convert -w 48 -h 48 -o icons/icon48.png tab-group-icon.svg
   rsvg-convert -w 128 -h 128 -o icons/icon128.png tab-group-icon.svg
   ```
3. **Manifest Integration**: Added icon references to both the global `icons` section and `action.default_icon`

### Manual Icon Generation (Alternative)

If you need to regenerate icons manually:

1. Install a tool like ImageMagick, Inkscape, or use an online SVG converter
2. Convert `tab-group-icon.svg` to PNG at the required sizes:
   - 16x16 pixels (for browser UI elements)
   - 32x32 pixels (for Firefox toolbar)
   - 48x48 pixels (for extension management)
   - 128x128 pixels (for store listings and high DPI displays)
3. Save files as `icons/icon{size}.png`

## Development

### Local Development Setup

1. **Clone/Download**: Get the extension files
2. **Open Firefox**: Navigate to `about:debugging`
3. **Load Extension**: Click "This Firefox" → "Load Temporary Add-on..." → Select `manifest.json`
4. **Test**: The extension will be loaded temporarily for testing

### Making Changes

1. **Edit Files**: Modify any extension files as needed
2. **Reload Extension**: In `about:debugging`, click "Reload" next to the extension
3. **Test Changes**: Verify functionality works as expected

### Key Files to Modify

- **`background.js`**: Core tab grouping logic and event handlers
- **`popup.html/popup.js`**: User interface for configuration
- **`manifest.json`**: Permissions, metadata, and icon references
- **`tab-group-icon.svg`**: Source icon (regenerate PNGs after changes)

### API Usage

This extension uses the following Firefox WebExtensions APIs:
- `tabs` - For tab management and monitoring
- `tabGroups` - For creating and updating tab groups
- `storage.local` - For persisting user configurations
- `runtime` - For message passing between scripts

## Troubleshooting

### Common Issues

**Extension not working after installation:**
- Ensure you have Firefox 91+ (tab groups support required)
- Check that the extension is enabled in `about:addons`
- Verify no other tab management extensions are conflicting

**Tabs not grouping automatically:**
- Check that auto-grouping is enabled (green indicator in popup)
- Verify hostname configuration matches exactly (no www. prefix needed)
- Reload the extension in `about:debugging` if issues persist

**Groups not showing custom names/colors:**
- Ensure configurations are saved (check the configurations list in popup)
- Try the "Regroup All" button to apply configurations to existing tabs
- Check browser console for any error messages

**Performance issues:**
- The extension processes tab changes in real-time
- Consider reducing the number of active configurations if experiencing slowdowns
- Large numbers of tabs may affect grouping performance

### Getting Help

1. Check the browser console for error messages (`F12` → Console)
2. Verify extension permissions in `about:addons`
3. Test with a minimal configuration first
4. Report issues with specific steps to reproduce

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly in Firefox
5. Submit a pull request

## License

This project is open source. Please check the license file for details.
