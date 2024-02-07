import { eq } from 'drizzle-orm';
import { CLOUDFRONT_URL } from '$env/static/private';
import {
	deleteS3Object,
	generateS3UploadPost,
	invalidateCloudfront,
	setS3Metadata,
	urlTransforms,
} from '$lib/cloudStorage/server';
import { detectModerationLabels } from '$lib/cloudStorage/server';
import { db, presigned, users } from '$lib/db/server';
import { jsonFail, jsonOk } from '$lib/http/server';
import { MAX_UPLOAD_SIZE, putReqSchema, type GetRes, type PutRes } from '.';
import type { RequestHandler } from './$types';
import type { RequestEvent } from '@sveltejs/kit';

const getSignedAvatarUploadUrl = async ({ locals }: RequestEvent) => {
	const { user } = await locals.seshHandler.userOrRedirect();

	const res = await generateS3UploadPost({ maxContentLength: MAX_UPLOAD_SIZE, expireSeconds: 60 });
	if (!res) return jsonFail(500, 'Failed to generate upload URL');

	await presigned.insert({ objectUrl: res.objectUrl, userId: user.id });

	return jsonOk<GetRes>(res);
};

const checkAndSaveUploadedAvatar = async (event: RequestEvent) => {
	const { request, locals } = event;
	const { user } = await locals.seshHandler.userOrRedirect();

	const body = await request.json().catch(() => null);
	const parsed = putReqSchema.safeParse(body);
	if (!parsed.success) return jsonFail(400);

	const presignedObjectUrl = await presigned.get({ userId: user.id });
	if (!presignedObjectUrl) return jsonFail(400);
	if (presignedObjectUrl.created.getTime() < Date.now() - 1000 * 60) {
		await presigned.delete({ userId: user.id });
		return jsonFail(400);
	}

	const cloudfrontUrl = urlTransforms.s3UrlToCloudfrontUrl(presignedObjectUrl.objectUrl);
	const imageExists = await fetch(cloudfrontUrl, { method: 'HEAD' }).then((res) => res.ok);
	if (!imageExists) {
		await presigned.delete({ userId: user.id });
		return jsonFail(400);
	}

	const avatar = { crop: parsed.data.crop, url: cloudfrontUrl };
	const key = urlTransforms.s3UrlToKey(presignedObjectUrl.objectUrl);

	const { error: moderationError } = await detectModerationLabels({ s3Key: key });

	if (moderationError) {
		await Promise.all([deleteS3Object({ key, disregardEnv: true }), presigned.delete({ userId: user.id })]);
		return jsonFail(422, moderationError.message);
	}

	if (user.avatar && user.avatar.url.startsWith(CLOUDFRONT_URL) && avatar.url !== user.avatar.url) {
		await Promise.all([deleteS3Object({ key }), invalidateCloudfront({ keys: [key] })]);
	}

	await Promise.all([
		presigned.delete({ userId: user.id }),
		db.update(users).set({ avatar }).where(eq(users.id, user.id)),
		setS3Metadata({ key, tags: { user_id: user.id, kind: 'avatar' } }),
	]);

	return jsonOk<PutRes>({ savedImg: avatar });
};

const deleteAvatar = async ({ locals }: RequestEvent) => {
	const { user } = await locals.seshHandler.userOrRedirect();
	if (!user.avatar) return jsonFail(404, 'No avatar to delete');

	const promises: Array<Promise<unknown>> = [db.update(users).set({ avatar: null }).where(eq(users.id, user.id))];

	if (user.avatar.url.startsWith(CLOUDFRONT_URL)) {
		const key = urlTransforms.cloudfrontUrlToKey(user.avatar.url);
		promises.push(deleteS3Object({ key }), invalidateCloudfront({ keys: [key] }));
	}

	await Promise.all(promises);

	return jsonOk<PutRes>({ savedImg: null });
};

export const GET: RequestHandler = getSignedAvatarUploadUrl;
export const PUT: RequestHandler = checkAndSaveUploadedAvatar;
export const DELETE: RequestHandler = deleteAvatar;