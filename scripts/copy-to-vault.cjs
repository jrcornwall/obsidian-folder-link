import "dotenv/config"; // Automatically loads .env
import fs from "fs";
import path from "path"

// Get vault plugin path from environment variable
const vaultPluginPath = process.env.OBSIDIAN_PLUGIN_PATH;

if (!vaultPluginPath) {
	console.error("OBISIDIAN_PLUGIN_PATH environment variable not set.");
	process.exit(1);
}

const root = path.join(__dirname, "..");
const filesToCopy = ["main.js", "manifest.json", "styles.css"];

for (const file of filesToCopy) {
	const src = path.join(root, file);
	const dest = path.join(vaultPluginPath, file);

	fs.copyFile(src, dest, (err) => {
		if (err) {
			console.error(`Failed to copy ${file}:`, err);
		} else {
			console.log(`Copied ${file} to ${dest}`);
		}
	});
}
