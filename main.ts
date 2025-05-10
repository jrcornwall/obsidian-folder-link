import {
	App,
	Plugin,
	TFile,
	PluginSettingTab,
	Setting,
	Notice,
	MarkdownPostProcessorContext,
} from "obsidian";

import { RangeSetBuilder } from "@codemirror/state";
import {
	Decoration,
	EditorView,
	ViewPlugin,
	ViewUpdate,
	WidgetType,
} from "@codemirror/view";

interface FolderLinkPluginSettings {
	folderPrefix: string;
	createFolderNote: boolean;
}

const DEFAULT_SETTINGS: FolderLinkPluginSettings = {
	folderPrefix: "",
	createFolderNote: true,
};

class FolderLinkWidget extends WidgetType {
	constructor(private folderName: string, private sourcePath: string) {
		super();
	}

	toDOM(): HTMLElement {
		const link = document.createElement("a");
		link.classList.add("folder-link");
		link.dataset.folder = this.folderName;
		link.dataset.sourcePath = this.sourcePath;
		link.innerText = this.folderName;
		link.style.cursor = "pointer";
		link.style.color = "var(--link-color)";
		link.style.textDecoration = "underline";
		return link;
	}

	eq(other: WidgetType): boolean {
		return (
			other instanceof FolderLinkWidget &&
			other.folderName === this.folderName &&
			other.sourcePath === this.sourcePath
		);
	}

	ignoreEvent(): boolean {
		return false;
	}
}

export default class FolderLinkPlugin extends Plugin {
	settings: FolderLinkPluginSettings;

	async onload() {
		await this.loadSettings();

		const folderLinkRegex = /\|\|([^|/:*?"<>]+\/)\|\|/g;

		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const plugin = this;
		const folderLinkPlugin = ViewPlugin.fromClass(
			class {
				decorations;
				view: EditorView;

				constructor(view: EditorView) {
					this.view = view;
					this.decorations = this.buildDecorations(view);
				}

				update(update: ViewUpdate) {
					if (update.docChanged || update.viewportChanged) {
						this.decorations = this.buildDecorations(update.view);
					}
				}

				buildDecorations(view: EditorView) {
					const builder = new RangeSetBuilder<Decoration>();
					const text = view.state.doc.toString();
					const activeFile = plugin.app.workspace.getActiveFile();
					const sourcePath = activeFile?.path ?? "";

					for (const { from, to } of view.visibleRanges) {
						const visibleText = text.slice(from, to);
						let match;
						while ((match = folderLinkRegex.exec(visibleText))) {
							const start = from + match.index;
							const folderName = match[1];

							const deco = Decoration.widget({
								widget: new FolderLinkWidget(
									folderName,
									sourcePath
								),
								side: 1,
							});

							builder.add(start, start + match[0].length, deco);
						}
					}
					return builder.finish();
				}
			},
			{
				decorations: (v) => v.decorations,
			}
		);

		this.registerEditorExtension(folderLinkPlugin);

		this.registerMarkdownPostProcessor(
			(element: HTMLElement, ctx: MarkdownPostProcessorContext) => {
				const textNodes = document.createTreeWalker(
					element,
					NodeFilter.SHOW_TEXT
				);
				let current: Node | null;

				while ((current = textNodes.nextNode())) {
					const text = current.nodeValue;
					if (!text) continue;

					const matches = [
						...text.matchAll(/\|\|([^|/:*?"<>]+\/)\|\|/g),
					];
					if (matches.length === 0) continue;

					const frag = document.createDocumentFragment();
					let lastIndex = 0;

					for (const match of matches) {
						const matchText = match[0];
						const folderName = match[1];
						const matchIndex = match.index ?? 0;

						if (matchIndex > lastIndex) {
							frag.appendChild(
								document.createTextNode(
									text.slice(lastIndex, matchIndex)
								)
							);
						}

						const link = document.createElement("a");
						link.classList.add("folder-link");
						link.dataset.folder = folderName;
						link.dataset.sourcePath = ctx.sourcePath;
						link.innerText = folderName;
						link.style.cursor = "pointer";
						link.style.color = "var(--link-color)";
						link.style.textDecoration = "underline";
						frag.appendChild(link);

						lastIndex = matchIndex + matchText.length;
					}

					if (lastIndex < text.length) {
						frag.appendChild(
							document.createTextNode(text.slice(lastIndex))
						);
					}

					current.parentNode?.replaceChild(frag, current);
				}
			}
		);

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

			const parentFolder = sourcePath.split("/").slice(0, -1).join("/");
			const folderPath = parentFolder
				? `${parentFolder}/${folderName}`
				: folderName;

			const exists = await this.app.vault.adapter.exists(folderPath);
			if (!exists) {
				await this.app.vault.createFolder(folderPath);

				if (this.settings.createFolderNote) {
					const folderNotePath = `${folderPath}/${folderName}.md`;
					const noteExists = await this.app.vault.adapter.exists(
						folderNotePath
					);
					if (!noteExists) {
						await this.app.vault.create(folderNotePath, "");
					}
				}

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
			.setName("Create folder note")
			.setDesc(
				"If enabled, a note with the same name will be created in each new folder."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.createFolderNote)
					.onChange(async (value) => {
						this.plugin.settings.createFolderNote = value;
						await this.plugin.saveSettings();
					})
			);

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
