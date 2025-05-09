import {
	App,
	Plugin,
	TFile,
	PluginSettingTab,
	Setting
} from "obsidian";

interface FolderLinkPluginSettings {
	folderPrefix: string;
}

const DEFAULT_SETTINGS: FolderLinkPluginSettings = {
	folderPrefix: "",
};

export default class FolderLinkPlugin extends Plugin {
	settings: FolderLinkPluginSettings;

	async onload() {
		await this.loadSettings();

		// Folder creation on file open based on [[folder/]] links
		this.registerEvent(
			this.app.workspace.on("file-open", async (file: TFile | null) => {
				if (!file || !file.path.endsWith(".md")) return;

				const content = await this.app.vault.read(file);
				const folderLinks = content.match(/\[\[([\w\s/-]+\/)\]\]/g);

				if (folderLinks) {
					for (const link of folderLinks) {
						const folderPath = link.slice(2, -2); // Remove [[ and ]]
						const exists = await this.app.vault.adapter.exists(
							folderPath
						);
						if (!exists) {
							await this.app.vault.createFolder(folderPath);
							console.log(`Created folder: ${folderPath}`);
						}
					}
				}
			})
		);

		this.addSettingTab(new FolderLinkSettingTab(this.app, this));
	}

	onunload() {
		console.log("FolderLinkPlugin unloaded.");
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class FolderLinkSettingTab extends PluginSettingTab {
	plugin: FolderLinkPlugin;

	constructor(app: App, plugin: FolderLinkPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Optional Folder Prefix")
			.setDesc("A prefix to add before folder names, e.g., 'Projects/'.")
			.addText((text) =>
				text
					.setPlaceholder("e.g., Projects/")
					.setValue(this.plugin.settings.folderPrefix)
					.onChange(async (value) => {
						this.plugin.settings.folderPrefix = value.trim();
						await this.plugin.saveSettings();
					})
			);
	}
}
