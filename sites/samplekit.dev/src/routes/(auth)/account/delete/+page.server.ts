import { auth } from '$lib/auth/server';
import { checkedRedirect } from '$lib/http/server';
import { objectStorage } from '$lib/object-storage/server';
import { superValidate, zod } from '$lib/superforms/server';
import { transports } from '$lib/transport/server';
import { pluralize } from '$lib/utils/common';
import { confirmPassSchema, sendSMSTokenSchema, verifyOTPSchema, type VerifierProps } from '$routes/(auth)';
import type { Action } from '@sveltejs/kit';

export const load = async ({ locals }) => {
	const { user, session } = await locals.seshHandler.userOrRedirect();

	const authDetails = await auth.provider.pass.MFA.getDetailsOrThrow(user.id);
	const kind = authDetails.mfaCount
		? ('Identity' as const)
		: authDetails.method === 'oauth'
			? ('Email' as const)
			: ('Password' as const);

	const redirectPath = `/account/delete`;

	const timeRemaining = auth.session.getTempConf({ session });
	const verified = !!timeRemaining;
	let expirationMsg = '';
	if (timeRemaining) expirationMsg = `Verification expires in ${timeRemaining} ${pluralize('minute', timeRemaining)}`;

	const confirmPassForm = await superValidate(zod(confirmPassSchema), { id: 'confirmPassForm_/account/delete' });
	confirmPassForm.data.redirect_path = redirectPath;

	const phoneNumberLast4 = authDetails.mfas.sms?.slice(-4);
	const [sendSMSTokenForm, verifySMSTokenForm, verifyAuthenticatorTokenForm] = await Promise.all([
		superValidate(zod(sendSMSTokenSchema), { id: 'sendSMSTokenForm_/account/delete' }),
		superValidate(zod(verifyOTPSchema), { id: 'verifySMSTokenForm_/account/delete' }),
		superValidate(zod(verifyOTPSchema), { id: 'verifyAuthenticatorTokenForm_/account/delete' }),
	]);

	verifySMSTokenForm.data.redirect_path = redirectPath;

	const veri: VerifierProps = {
		next: '/account/delete',
		email: user.email,
		verified,
		kind,
		expirationMsg,
		pass: { confirmPassForm },
		mfa: {
			mfaCount: authDetails.mfaCount,
			mfasEnabled: authDetails.mfasEnabled,
			sms: { phoneNumberLast4, sendSMSTokenForm, verifyOTPForm: verifySMSTokenForm },
			authenticator: { verifyOTPForm: verifyAuthenticatorTokenForm },
		},
	};

	const meta: App.PageData['meta'] = { title: 'Delete Account | SampleKit' };

	return { veri, meta };
};

const deleteUser = async (user: DB.User) => {
	if (objectStorage.keyController.is.cdnUrl(user.avatar?.url)) {
		const key = objectStorage.keyController.transform.cdnUrlToKey(user.avatar.url);
		await Promise.all([
			objectStorage.delete({ key, guard: () => objectStorage.keyController.guard.root({ key }) }),
			objectStorage.invalidateCDN({ keys: [key] }),
		]);
	}

	await Promise.all([
		auth.user.delete({ userId: user.id }),
		transports.email.send.accountDeleted({ email: user.email }),
	]);
};

const deleteUserWithSeshConf: Action = async ({ locals }) => {
	const { user, session } = await locals.seshHandler.userOrRedirect();

	const timeRemaining = auth.session.getTempConf({ session });
	if (timeRemaining === null) return checkedRedirect('/account/delete');

	await deleteUser(user);
	locals.seshHandler.set({ session: null });

	return checkedRedirect('/');
};

export const actions = { deleteUserWithSeshConf };
