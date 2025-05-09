import { App, Plugin, PluginSettingTab, Setting, Notice } from "obsidian";

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

		// Post-process markdown to convert ||Folder/|| into clickable folder links
		this.registerMarkdownPostProcessor((element, context) => {
			const matches = element.innerHTML.matchAll(/\|\|([^|/\\:*?"<>]+\/)\|\|/g);

			for (const match of matches) {
				const folderName = match[1].trim();
				const fullMatch = match[0];

				// Replace with a clickable styled link element
				element.innerHTML = element.innerHTML.replace(
					fullMatch,
					`<a class="folder-link" data-folder="${folderName}" style="cursor:pointer; color:var(--link-color); text-decoration:underline;">${folderName}</a>`
				);
			}
		});

		// Global click handler for folder-link elements
		document.addEventListener("click", async (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			if (target?.classList.contains("folder-link")) {
				const folder = target.dataset.folder;
				if (!folder) return;

				e.preventDefault();

				const exists = await this.app.vault.adapter.exists(folder);
				if (!exists) {
					await this.app.vault.createFolder(folder);
					new Notice(`Created folder: ${folder}`);
				} else {
					new Notice(`Folder already exists: ${folder}`);
				}
			}
		});

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
			.setDesc("Currently unused, reserved for future development.")
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
