import {
	App,
	Plugin,
	TFile,
	PluginSettingTab,
	Setting,
	Notice
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

		// Watch for newly created files
		this.registerEvent(
			this.app.vault.on("create", async (file) => {
				if (!(file instanceof TFile) || !file.path.endsWith(".md")) return;

				const content = await this.app.vault.read(file);
				const folderLinks = content.match(/\[\[([^\]]+\/)\]\]/g);

				if (folderLinks) {
					for (const link of folderLinks) {
						const folderPath = link.slice(2, -2); // Remove [[ and ]]
						const exists = await this.app.vault.adapter.exists(folderPath);
						if (!exists) {
							await this.app.vault.createFolder(folderPath);
							console.log(`Created folder: ${folderPath}`);
							new Notice(`Created folder: ${folderPath}`);
						} else {
							console.log(`Folder already exists: ${folderPath}`);
							new Notice(`Folder already exists: $[folderPath}`);
						}
					}

					// Optional: delete the file if it only contains a folder link
					if (folderLinks.length === 1 && content.trim() === folderLinks[0]) {
						await this.app.vault.delete(file);
						console.log(`🗑️ Deleted placeholder file: ${file.path}`);
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
