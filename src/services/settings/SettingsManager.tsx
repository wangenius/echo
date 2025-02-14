import { Echo } from "echo-state";

interface SettingsProps {
	theme: { name: string, label: string };
	language: string;
	reActMaxIterations: number;
}

export class SettingsManager {
	private static store = new Echo<SettingsProps>({
		theme: { name: "light", label: "浅色" },
		language: "zh-CN",
		reActMaxIterations: 10,
	}, {
		name: "settings",
		sync: true
	});

	static use = this.store.use.bind(this.store)

	public static getTheme() {
		return this.store.current.theme;
	}

	public static getReactMaxIterations() {
		return this.store.current.reActMaxIterations;
	}

	public static setReactMaxIterations(maxIterations: number) {
		this.store.set((prev) => ({ ...prev, reActMaxIterations: maxIterations }));
	}

	public static setTheme(theme: { name: string, label: string }) {
		this.store.set((prev) => ({ ...prev, theme }), true);
	}


}

