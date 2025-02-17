import { App, Plugin, PluginSettingTab, Setting, MarkdownView, TFile } from 'obsidian';

interface NFLSettings {
    colors: string[];
    unfocusedColor: string;
    enableFocus: boolean;
    lineStyle: 'solid' | 'dashed' | 'dotted';
}

const DEFAULT_SETTINGS: NFLSettings = {
    colors: ['#ff5252', '#f99d6c', '#53c169', '#747dfb', '#f098fb'],
    unfocusedColor: '#999999',
    enableFocus: true,
    lineStyle: 'solid'
};

class NFLSettingTab extends PluginSettingTab {
    plugin: RainbowTreePlugin;

    constructor(app: App, plugin: RainbowTreePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;
        containerEl.empty();

        const colorNames = ['First level', 'Second level', 'Third level', 'Fourth level', 'Fifth level'];
        colorNames.forEach((name, i) => {
            new Setting(containerEl)
                .setName(`${name} color`)
                .setDesc(`Color for ${name.toLowerCase()} folder lines`)
                .addColorPicker(color => color
                    .setValue(this.plugin.settings.colors[i])
                    .onChange(async (value) => {
                        this.plugin.settings.colors[i] = value;
                        await this.plugin.saveSettings();
                    }));
        });

        new Setting(containerEl)
            .setName('Line style')
            .setDesc('Choose the style for folder connection lines')
            .addDropdown(dropdown => dropdown
                .addOption('solid', 'Solid')
                .addOption('dashed', 'Dashed')
                .addOption('dotted', 'Dotted')
                .setValue(this.plugin.settings.lineStyle)
                .onChange(async (value: 'solid' | 'dashed' | 'dotted') => {
                    this.plugin.settings.lineStyle = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Unfocused title color')
            .setDesc('Color for unfocused file and folder titles')
            .addColorPicker(color => color
                .setValue(this.plugin.settings.unfocusedColor)
                .onChange(async (value) => {
                    this.plugin.settings.unfocusedColor = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('Enable focus mode')
            .setDesc('Highlight active files and their parent folders')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableFocus)
                .onChange(async (value) => {
                    this.plugin.settings.enableFocus = value;
                    await this.plugin.saveSettings();
                }));
    }
}

export default class RainbowTreePlugin extends Plugin {
    private styleElement: HTMLStyleElement;
    private focusedPaths: Set<string> = new Set();
    settings: NFLSettings;

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new NFLSettingTab(this.app, this));
        
        this.styleElement = document.createElement('style');
        this.styleElement.id = 'nested-folder-lines-styles';
        document.head.appendChild(this.styleElement);
        
        this.updateBaseStyles();
        
        this.registerEvent(
            this.app.workspace.on('file-open', (file) => {
                if (file) {
                    this.updateFocusedPaths();
                }
            })
        );

        this.registerEvent(
            this.app.workspace.on('layout-change', () => {
                this.updateFocusedPaths();
            })
        );

        this.updateFocusedPaths();
    }

    onunload() {
        this.styleElement.remove();
        document.body.classList.remove('plugin-nested-folder-lines-focus');
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        this.updateBaseStyles();
        this.updateFocusedPaths();
    }

    private updateFocusedPaths() {
        this.focusedPaths.clear();
        
        const openLeaves = this.app.workspace.getLeavesOfType('markdown');
        for (const leaf of openLeaves) {
            const view = leaf.view;
            const file = view instanceof MarkdownView ? view.file : null;
            
            if (file instanceof TFile) {
                const filePath = file.path;
                this.focusedPaths.add(filePath);
                
                const pathSegments = filePath.split('/');
                let currentPath = '';
                for (let i = 0; i < pathSegments.length - 1; i++) {
                    currentPath += (i > 0 ? '/' : '') + pathSegments[i];
                    this.focusedPaths.add(currentPath);
                }
            }
        }
        
        this.updateFocusStyles();
    }

    private updateBaseStyles() {
        let baseStyles = '';
        const maxLevels = 10;
        
        // Set CSS variable for unfocused color
        document.body.style.setProperty('--nfl-unfocused-color', this.settings.unfocusedColor);
        
        for (let i = 0; i < maxLevels; i++) {
            const colorIndex = i % this.settings.colors.length;
            const nestedSelectors = '.nav-folder-children '.repeat(i);
            const color = this.settings.colors[colorIndex];
            
            baseStyles += `
                ${nestedSelectors}.nav-folder-children::before {
                    border-left: 1px ${this.settings.lineStyle} ${color};
                }
            `;
        }
        
        this.styleElement.textContent = baseStyles;
    }

    private updateFocusStyles() {
        // Toggle focus mode class on body
        document.body.classList.toggle('plugin-nested-folder-lines-focus', this.settings.enableFocus);

        // Update focused paths
        const elements = document.querySelectorAll('[data-path]');
        elements.forEach(el => {
            el.classList.toggle('focused', this.focusedPaths.has(el.getAttribute('data-path') || ''));
        });
    }
}