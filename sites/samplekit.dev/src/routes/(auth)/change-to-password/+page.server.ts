import { fail as formFail } from '@sveltejs/kit';
import { auth } from '$lib/auth/server';
import { checkedRedirect } from '$lib/http/server';
import { transports } from '$lib/transport/server';

export const load = async ({ locals }) => {
	const seshUser = await locals.seshHandler.getSessionUser();
	if (!seshUser) return checkedRedirect('/login');
	if ((await auth.provider.getMethodOrThrow(seshUser.user.id)) === 'pass') return checkedRedirect('/account/profile');
};

const changeToEmailPassProvider: App.CommonServerAction = async ({ locals }) => {
	const { user } = await locals.seshHandler.userOrRedirect();

	const { tokenErr, token } = await auth.token.pwReset.createOrRefresh({ userId: user.id });
	if (tokenErr) return auth.token.err.toFormFail(tokenErr);
	const { transportErr } = await transports.email.send.passwordResetToken({ token, email: user.email });
	if (transportErr) return formFail(500, { fail: 'Sorry, we are unable to send email at this time.' });

	return { success: 'Password setup email sent.' };
};

export const actions = { changeToEmailPassProvider };
