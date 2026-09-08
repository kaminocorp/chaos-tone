import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { mapIntent } from '$lib/dj/intent';
import { parseMeta, readJsonBody } from '$lib/dj/http';

/** intent — body: { text, if_revision?, client_op_id?, bars? } */
export const POST: RequestHandler = async ({ request }) => {
	const body = await readJsonBody(request);
	const text = typeof body.text === 'string' ? body.text : '';
	const mapped = mapIntent(text, parseMeta(body));

	if (!mapped.ok) {
		const status = mapped.result && !mapped.result.ok ? mapped.result.status : 400;
		const session =
			mapped.result && !mapped.result.ok && mapped.result.status === 409
				? mapped.result.session
				: undefined;
		return json(
			{
				ok: false,
				verb: mapped.verb,
				text: mapped.text,
				error: mapped.error ?? (mapped.result && !mapped.result.ok ? mapped.result.error : 'intent failed'),
				detail: mapped.detail,
				session
			},
			{ status }
		);
	}

	const result = mapped.result!;
	if (!result.ok) {
		// should be unreachable when mapped.ok, but keep shape consistent
		return json({ ok: false, verb: mapped.verb, text: mapped.text, error: result.error }, { status: result.status });
	}

	return json({
		ok: true,
		verb: mapped.verb,
		text: mapped.text,
		detail: mapped.detail,
		replayed: result.replayed,
		session: result.session
	});
};
