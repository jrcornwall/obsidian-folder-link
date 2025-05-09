import {
	App,
	Plugin,
	TFile,
	PluginSettingTab,
	Setting,
	Notice,
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

		this.registerEvent(
			this.app.vault.on("create", async (file) => {
				if (!(file instanceof TFile) || !file.path.endsWith(".md"))
					return;

				const content = await this.app.vault.read(file);
				const folderLinks = content.match(/\|\|([^|]+\/)\|\|/g); // Match ||folder/||

				if (!folderLinks) return;

				for (const rawLink of folderLinks) {
					const folderPath = rawLink.slice(2, -2).trim(); // Remove || ||

					// Delete note if its filename matches folder name
					const filenameWithoutExt = file.basename;
					const folderName = folderPath.replace(/\/$/, "");

					if (filenameWithoutExt === folderName) {
						await this.app.vault.delete(file);
						console.log(`🗑️ Deleted misnamed file: ${file.path}`);
					}

					const exists = await this.app.vault.adapter.exists(
						folderPath
					);
					if (!exists) {
						await this.app.vault.createFolder(folderPath);
						console.log(`📁 Created folder: ${folderPath}`);
						new Notice(`📁 Created folder: ${folderPath}`);
					} else {
						console.log(`✅ Folder already exists: ${folderPath}`);
						new Notice(`✅ Folder already exists: ${folderPath}`);
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
