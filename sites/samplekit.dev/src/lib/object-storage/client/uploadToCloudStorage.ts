import { logger } from '$lib/logging/client';
import type { Result } from '$lib/utils/common';
import type { ObjectStorageClient } from './types';

export const uploadToCloudStorage: ObjectStorageClient['upload'] = ({ url, formData, uploadProgress }) => {
	const req = new XMLHttpRequest();
	req.open('POST', url);

	if (uploadProgress?.tweened) {
		req.upload.addEventListener('progress', (e) =>
			uploadProgress.tweened?.update((p) => Math.max(p, (e.loaded / e.total) * 100 * (uploadProgress?.scale ?? 1))),
		);
	}

	const promise = new Promise<Result<{ status: number }>>((resolve) => {
		req.onreadystatechange = () => {
			if (req.readyState === 4) {
				if (req.status >= 200 && req.status < 300) {
					resolve({ data: { status: req.status } });
				} else if (req.status === 0) {
					resolve({ error: { status: 499, message: 'Upload aborted' } });
				} else {
					logger.error(`Error uploading file. Status: ${req.status}. Response: ${req.responseText}`);
					resolve({ error: { status: req.status, message: 'Error uploading file' } });
				}
			}
		};
	});

	req.send(formData);
	return { abort: req.abort.bind(req), promise };
};
