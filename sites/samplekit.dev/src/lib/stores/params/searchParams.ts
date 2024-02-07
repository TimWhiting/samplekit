import { derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { page } from '$app/stores';
import { assertUnreachable } from '$lib/utils/common';

/** `false` if the value is not changed, `Promise<false>` if called on the server, and `Promise<true>` if the value and url change */
type Changed = false | Promise<boolean>;

export const cloneParams = () => new URLSearchParams(get(page).url.search);

export const go = async (searchParams: URLSearchParams, opts?: { absolute?: string }) => {
	if (browser) {
		return goto(`${opts?.absolute ?? ''}?${searchParams}`, {
			keepFocus: true,
			noScroll: true,
			replaceState: true,
		}).then(() => true);
	} else {
		return false;
	}
};

/**`$store` is equivalent to $page.url.searchParams.get(param) */
export const searchParam = (
	name: string,
	{ clean, skipInitGoto }: { clean?: (value: string | null) => string | null; skipInitGoto?: true } = {},
) => {
	const store = derived(page, ($page) => $page.url.searchParams.get(name));
	const serialize = clean || ((v) => v || null);

	const init = (): void => {
		if (skipInitGoto) return;
		set(get(store));
	};

	/** If mutSearchParams are updated, returns a reference to it. Otherwise returns false. */
	const mutateSearchParams = ({
		value,
		mutSearchParams,
	}: {
		value?: { cleaned?: never; unclean?: string | null } | { cleaned?: string | null; unclean?: never };
		mutSearchParams: URLSearchParams;
	}): false | URLSearchParams => {
		const newValue = value?.cleaned ?? serialize(value?.unclean ?? null);
		if (mutSearchParams.get(name) === newValue) {
			return false;
		}
		if (!newValue) mutSearchParams.delete(name);
		else mutSearchParams.set(name, newValue);
		return mutSearchParams;
	};

	const pushStateToParams = ({ mutSearchParams }: { mutSearchParams: URLSearchParams }): false | URLSearchParams => {
		return mutateSearchParams({ mutSearchParams, value: { unclean: get(page).url.searchParams.get(name) } });
	};

	const set = (unclean?: string | null, opts?: { absolute?: string }): Changed => {
		const newParams = mutateSearchParams({ value: { unclean }, mutSearchParams: cloneParams() });
		return newParams ? go(newParams, opts) : false;
	};

	const toggle = (unclean: string, opts?: { absolute?: string }): Changed => {
		const mutSearchParams = cloneParams();
		const oldValue = mutSearchParams.get(name);
		const newValue = serialize(unclean);
		const newParams = mutateSearchParams({
			value: { cleaned: newValue === oldValue ? null : newValue },
			mutSearchParams,
		});
		return newParams ? go(newParams, opts) : false;
	};

	init();

	return {
		subscribe: store.subscribe,
		mutateSearchParams,
		pushStateToParams,
		set,
		toggle,
	};
};
export type SearchParam = ReturnType<typeof searchParam>;

/** `$store` is equivalent to $page.url.searchParams.getAll(`${param}`) */
export const searchParams = (
	param: string,
	{ clean, skipInitGoto }: { clean?: (value: string | null) => string | null; skipInitGoto?: true } = {},
) => {
	const store = derived(page, ($page) => $page.url.searchParams.getAll(`${param}`));
	const serialize = clean || ((v) => v || null);

	const init = (): void => {
		if (skipInitGoto) return;
		set(get(store));
	};

	/** If mutSearchParams are updated, returns a reference to it. Otherwise returns false. */
	const mutateSearchParams = ({
		unclean,
		mutSearchParams,
	}: {
		unclean?: string[];
		mutSearchParams: URLSearchParams;
	}): false | URLSearchParams => {
		const preMutatedParams = new URLSearchParams(mutSearchParams);
		mutSearchParams.delete(param);
		unclean?.forEach((v) => {
			const cleaned = serialize(v);
			if (cleaned) mutSearchParams.append(param, cleaned);
		});
		if (preMutatedParams.toString() !== mutSearchParams.toString()) return mutSearchParams;
		return false;
	};

	const pushStateToParams = ({ mutSearchParams }: { mutSearchParams: URLSearchParams }): false | URLSearchParams => {
		return mutateSearchParams({ mutSearchParams, unclean: get(page).url.searchParams.getAll(param) });
	};

	const set = (unclean?: string[], opts?: { absolute?: string }): Changed => {
		const newParams = mutateSearchParams({ unclean, mutSearchParams: cloneParams() });
		return newParams ? go(newParams, opts) : false;
	};

	const updateOne = (
		unclean: string,
		action: 'add' | 'append' | 'remove' | 'toggle',
		opts?: { absolute?: string },
	): Changed => {
		const value = serialize(unclean);
		if (value === null) return false;
		const mutSearchParams = cloneParams();

		if (action === 'append') {
			mutSearchParams.append(param, value);
			return go(mutSearchParams, opts);
		}

		const paramValues = mutSearchParams.getAll(param);
		const index = paramValues.findIndex((p) => p === value);

		if (index === -1) {
			if (action === 'remove') return false;
			mutSearchParams.append(param, value);
			return go(mutSearchParams, opts);
		} else {
			if (action === 'add') return false;
			paramValues.splice(index, 1);
			mutSearchParams.delete(param);
			paramValues.forEach((p) => mutSearchParams.append(param, p));
			return go(mutSearchParams, opts);
		}
	};

	const updateMany = (
		unclean: string[],
		action: 'add' | 'append' | 'remove' | 'toggle',
		opts?: { absolute?: string },
	): Changed => {
		const values = unclean.map(serialize).filter((v) => v !== null) as string[];
		if (!values.length) return false;

		const mutSearchParams = cloneParams();

		let changed = false;

		switch (action) {
			case 'append': {
				changed = true;
				for (const value of values) {
					mutSearchParams.append(param, value);
				}
				break;
			}
			case 'add': {
				const paramSet = new Set(mutSearchParams.getAll(param));
				for (const value of values) {
					if (!paramSet.has(value)) {
						changed = true;
						mutSearchParams.append(param, value);
					}
				}
				break;
			}
			case 'remove': {
				const paramValues = mutSearchParams.getAll(param);
				for (const value of values) {
					const index = paramValues.findIndex((p) => p === value);
					if (index !== -1) {
						changed = true;
						paramValues.splice(index, 1);
					}
				}
				if (changed) {
					mutSearchParams.delete(param);
					paramValues.forEach((p) => mutSearchParams.append(param, p));
				}
				break;
			}
			case 'toggle': {
				const paramValues = mutSearchParams.getAll(param);
				changed = true;
				for (const value of values) {
					const index = paramValues.findIndex((p) => p === value);
					if (index !== -1) {
						paramValues.splice(index, 1);
					} else {
						paramValues.push(value);
					}
				}
				mutSearchParams.delete(param);
				paramValues.forEach((p) => mutSearchParams.append(param, p));
				break;
			}
			default: {
				assertUnreachable(action);
			}
		}

		if (changed) return go(mutSearchParams, opts);
		return false;
	};

	init();

	return {
		subscribe: store.subscribe,
		mutateSearchParams,
		pushStateToParams,
		set,
		updateOne,
		updateMany,
	};
};
export type SearchParams = ReturnType<typeof searchParams>;

export const initMany = (params: Array<ReturnType<typeof searchParam | typeof searchParams>>): Changed => {
	const mutSearchParams = cloneParams();

	const changed = params.reduce<boolean>((acc, curr) => {
		const changed = !!curr.pushStateToParams({ mutSearchParams });
		return acc || changed;
	}, false);

	if (!changed) return false;
	return go(mutSearchParams);
};
