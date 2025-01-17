import { redirect, type RequestHandler } from '@sveltejs/kit';
import { GOOGLE_OAUTH_CLIENT_SECRET } from '$env/static/private';
import { PUBLIC_GOOGLE_OAUTH_CLIENT_ID } from '$env/static/public';
import { auth } from '$lib/auth/server';
import { getDeviceInfo } from '$lib/device-info';
import { checkedRedirect } from '$lib/http/server';
import { logger } from '$lib/logging/server';
import { transports } from '$lib/transport/server';
import { PUBLIC_GOOGLE_OAUTH_LINK_PATHNAME, type ChangeToGoogleError } from '../consts';

const changeToGoogleProvider: RequestHandler = async ({ url, cookies, locals, request, getClientAddress }) => {
	const { user, session: oldSession } = await locals.seshHandler.userOrRedirect();

	const authDetails = await auth.provider.pass.MFA.getDetailsOrThrow(user.id);
	if (authDetails.method === 'oauth') return checkedRedirect('/account/profile');
	if (authDetails.mfaCount) return checkedRedirect('/account/profile');

	const res = await auth.provider.oauth.google.serverCBUrlToOAuthData({
		cookies,
		url,
		redirectPathname: PUBLIC_GOOGLE_OAUTH_LINK_PATHNAME,
		clientId: PUBLIC_GOOGLE_OAUTH_CLIENT_ID,
		clientSecret: GOOGLE_OAUTH_CLIENT_SECRET,
	});
	if (!res.success) {
		logger.error(res.error);
		return redirect(302, `/change-to-google?error=${'auth-failed' satisfies ChangeToGoogleError}`);
	}

	if (res.data.clean_email !== user.email) {
		return redirect(302, `/change-to-google?error=${'email-mismatch' satisfies ChangeToGoogleError}`);
	}

	const [session] = await Promise.all([
		auth.session.deleteAll({ userId: user.id }).then(() =>
			auth.session.create(
				{
					userId: user.id,
					awaitingMFA: false,
					awaitingEmailVeri: false,
					persistent: oldSession.persistent,
				},
				getDeviceInfo({ headers: request.headers, getClientAddress }),
			),
		),
		auth.provider.changeToOAuth({ userId: user.id, provider: 'google' }),
		transports.email.send.providerMethodChanged({
			email: user.email,
			newProvider: { kind: 'oauth', provider: 'google' },
		}),
	]);

	locals.seshHandler.set({ session });

	return checkedRedirect('/account/profile');
};

export const GET = changeToGoogleProvider;
