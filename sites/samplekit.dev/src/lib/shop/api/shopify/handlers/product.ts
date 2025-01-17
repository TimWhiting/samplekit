import { getCollectionProductsQuery, getProductQuery, getProductRecommendationsQuery, getProductsQuery } from '../gql';
import { requestStorefront } from '../storefront';
import type { ProductFilter } from '$generated/shopify-graphql-types/storefront.types';
import type {
	GetCollectionProducts,
	GetProduct,
	GetProductRecommendations,
	GetProducts,
	SortKey,
	Product,
} from '../../types';

// prettier-ignore
type ProductCollectionSortKeys = 'BEST_SELLING' | 'COLLECTION_DEFAULT' | 'CREATED' | 'ID' | 'MANUAL' | 'PRICE' | 'RELEVANCE' | 'TITLE'
const sortKeyToProductCollectionSortKey = (sortKey?: SortKey): ProductCollectionSortKeys => {
	switch (sortKey) {
		case undefined:
			return 'RELEVANCE';
		case 'CREATED_AT':
			return 'CREATED';
		default:
			return sortKey;
	}
};

// prettier-ignore
type ProductSortKeys = 'BEST_SELLING' | 'CREATED_AT' | 'ID' | 'PRICE' | 'PRODUCT_TYPE' | 'RELEVANCE' | 'TITLE' | 'UPDATED_AT' | 'VENDOR'
const sortKeyToProductSortKey = (sortKey?: SortKey): ProductSortKeys => {
	switch (sortKey) {
		case undefined:
			return 'RELEVANCE';
		default:
			return sortKey;
	}
};

export const getCollectionProducts: GetCollectionProducts = async ({ filters, collectionHandle, fetch }) => {
	const { reverse, sortKey, availability, query, price } = filters;
	const productFilter: ProductFilter[] = [];
	if (availability !== undefined) productFilter.push({ available: availability });
	if (price) productFilter.push({ price });

	const res = await requestStorefront({
		operation: getCollectionProductsQuery,
		variables: {
			handle: collectionHandle,
			reverse,
			productFilter,
			// @ts-expect-error code-gen is generating enums in a d.ts file :(
			sortKey: sortKeyToProductCollectionSortKey(sortKey),
		},
		fetch,
	});

	if (!res.data?.collection) {
		return null;
	}

	const q = query?.trim().toLowerCase();
	const products = res.data.collection.products.edges.reduce((acc, { node }) => {
		if (q && !node.title.toLowerCase().includes(q)) return acc;
		acc.push({
			...node,
			variants: node.variants.edges.map((e) => e.node),
			images: node.images.edges.map((e) => e.node),
		});
		return acc;
	}, [] as Product[]);

	return products;
};

export const getProduct: GetProduct = async ({ handle, fetch }) => {
	const res = await requestStorefront({ operation: getProductQuery, variables: { handle }, fetch });
	const product = res.data?.product;
	if (!product) return undefined;
	else {
		const images = product.images.edges.map((e) => e.node);
		return { ...product, images, variants: product.variants.edges.map((e) => e.node) };
	}
};

/** @throws Error */
export const getProductRecommendations: GetProductRecommendations = async ({ productId, fetch }) => {
	const res = await requestStorefront({
		operation: getProductRecommendationsQuery,
		variables: { productId },
		fetch,
	});

	const productRecommendations = res?.data?.productRecommendations;

	if (!productRecommendations) throw new Error('getProductRecommendations');

	return productRecommendations.map((p) => ({
		...p,
		variants: p.variants.edges.map((e) => e.node),
		images: p.images.edges.map((e) => e.node),
	}));
};

// https://shopify.dev/docs/api/storefront/2024-10/queries/products#argument-products-query
const queryBuilder = (
	options: {
		availability?: boolean;
		title?: string;
		price?: { min?: number | undefined; max?: number | undefined } | undefined;
	} = {},
): string | undefined => {
	let query = '';
	if (options.title) query += `(title:${options.title}) `;
	if (options.availability === true) query += `(available_for_sale:true) `;
	if (options.availability === false) query += `(-available_for_sale:true) `;
	if (options.price?.min !== undefined) query += `(variants.price:>=${options.price.min}) `;
	if (options.price?.max !== undefined) query += `(variants.price:<=${options.price.max}) `;

	return query || undefined;
};

/** @throws Error */
export const getProducts: GetProducts = async ({ filters, fetch }) => {
	const { first, reverse, sortKey, availability, query, price } = filters;
	const res = await requestStorefront({
		operation: getProductsQuery,
		variables: {
			first: first ?? 100,
			reverse,
			query: queryBuilder({ availability, title: query?.trim(), price }),
			// @ts-expect-error code-gen is generating enums in a d.ts file :(
			sortKey: sortKeyToProductSortKey(sortKey),
		},
		fetch,
	});
	if (!res.data?.products) throw new Error('getProducts');
	return res.data.products.edges.map((e) => ({
		...e.node,
		variants: e.node.variants.edges.map((e) => e.node),
		images: e.node.images.edges.map((e) => e.node),
	}));
};
