import {
	App,
	Plugin,
	TFile,
	PluginSettingTab,
	Setting,
	Notice,
	MarkdownPostProcessorContext,
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

		// Handle ||folder/|| rendering in Live Preview and Reading View
		this.registerMarkdownPostProcessor(
			(element, ctx: MarkdownPostProcessorContext) => {
				element
					.querySelectorAll("span.cm-inline-code")
					.forEach((el) => {
						const text = el.textContent?.trim();
						if (text?.match(/^(\|\|[^|/:*?"<>]+\/\|\|)$/)) {
							const folderName = text.slice(2, -2).trim();

							// Create clickable link
							const link = document.createElement("a");
							link.classList.add("folder-link");
							link.dataset.folder = folderName;
							link.dataset.sourcePath = ctx.sourcePath;
							link.innerText = folderName;
							link.style.cursor = "pointer";
							link.style.color = "var(--link-color)";
							link.style.textDecoration = "underline";

							el.replaceWith(link);
						}
					});
			}
		);

		// Handle click events on folder links
		document.addEventListener("click", async (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			if (!target.classList.contains("folder-link")) return;

			e.preventDefault();

			const folderName = target.dataset.folder;
			const sourcePath = target.dataset.sourcePath;

			if (!folderName || !sourcePath) return;

			const currentFile =
				this.app.vault.getAbstractFileByPath(sourcePath);
			if (!currentFile || !(currentFile instanceof TFile)) {
				new Notice("⚠️ Could not determine origin note location.");
				return;
			}

			// Build relative folder path
			const parentFolder = sourcePath.split("/").slice(0, -1).join("/");
			const folderPath = parentFolder
				? `${parentFolder}/${folderName}`
				: folderName;

			const exists = await this.app.vault.adapter.exists(folderPath);
			if (!exists) {
				await this.app.vault.createFolder(folderPath);
				new Notice(`📁 Created folder: ${folderPath}`);
			} else {
				new Notice(`✅ Folder already exists: ${folderPath}`);
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
			.setDesc(
				"Currently unused; future support for prefixing folder paths."
			)
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
