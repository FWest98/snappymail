import { dropdownVisibility } from 'Common/Globals';
import * as Enums from 'Common/Enums';
import * as Plugins from 'Common/Plugins';
import { i18n } from 'Common/Translator';

import { root } from 'Common/Links';

export default (App) => {

	addEventListener('keydown', event => {
		event = event || window.event;
		if (event && event.ctrlKey && !event.shiftKey && !event.altKey) {
			if ('S' == event.key) {
				event.preventDefault();
			} else if ('A' == event.key) {
				const sender = event.target || event.srcElement;
				if (
					sender &&
					('true' === '' + sender.contentEditable || (sender.tagName && sender.tagName.match(/INPUT|TEXTAREA/i)))
				) {
					return;
				}

				getSelection().removeAllRanges();

				event.preventDefault();
			}
		}
	});

	addEventListener('click', ()=>rl.Dropdowns.detectVisibility());

	rl.app = App;
	rl.logoutReload = () => App && App.logoutReload && App.logoutReload();

	rl.i18n = i18n;

	rl.addSettingsViewModel = Plugins.addSettingsViewModel;
	rl.addSettingsViewModelForAdmin = Plugins.addSettingsViewModelForAdmin;

	rl.settingsGet = Plugins.mainSettingsGet;
	rl.pluginSettingsGet = Plugins.settingsGet;
	rl.pluginRemoteRequest = Plugins.remoteRequest;

	rl.Enums = Enums;

	rl.Dropdowns = [];
	rl.Dropdowns.register = function(element) { this.push(element); };
	rl.Dropdowns.detectVisibility = (() =>
		dropdownVisibility(!!rl.Dropdowns.find(item => item.classList.contains('show')))
	).debounce(50);

	rl.route = {
		root: () => {
			rl.route.setHash(root(), true);
			rl.route.off();
		},
		reload: () => {
			rl.route.root();
			setTimeout(() => (rl.settings.app('inIframe') ? parent : window).location.reload(), 100);
		},
		off: () => hasher.changed.active = false,
		on: () => hasher.changed.active = true,
		/**
		 * @param {string} sHash
		 * @param {boolean=} silence = false
		 * @param {boolean=} replace = false
		 * @returns {void}
		 */
		setHash: (hash, silence = false, replace = false) => {
			hash = hash.replace(/^[#/]+/, '');

			const cmd = replace ? 'replaceHash' : 'setHash';

			if (silence) {
				hasher.changed.active = false;
				hasher[cmd](hash);
				hasher.changed.active = true;
			} else {
				hasher.changed.active = true;
				hasher[cmd](hash);
				hasher.setHash(hash);
			}
		}
	};

	rl.fetchJSON = (resource, init, postData) => {
		init = Object.assign({
			mode: 'same-origin',
			cache: 'no-cache',
			redirect: 'error',
			referrerPolicy: 'no-referrer',
			credentials: 'same-origin'
		}, init);

		if (postData) {
			init.method = 'POST';
			init.headers = {
//				'Content-Type': 'application/json'
				'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
			};
			postData.XToken = rl.settings.app('token');
//			init.body = JSON.stringify(postData);
			const formData = new FormData(),
			buildFormData = (formData, data, parentKey) => {
				if (data && typeof data === 'object' && !(data instanceof Date || data instanceof File)) {
					Object.keys(data).forEach(key =>
						buildFormData(formData, data[key], parentKey ? `${parentKey}[${key}]` : key)
					);
				} else {
					formData.set(parentKey, data == null ? '' : data);
				}
			};
			buildFormData(formData, postData);
			init.body = new URLSearchParams(formData);
		}

		return fetch(resource, init).then(response => response.json());
	};

	window.__APP_BOOT = fErrorCallback => {
		const doc = document,
			cb = () => setTimeout(() => {
				if (rl.TEMPLATES) {
					doc.getElementById('rl-templates').innerHTML = rl.TEMPLATES;
					setTimeout(() => App.bootstart(), 10);
				} else {
					fErrorCallback();
				}

				window.__APP_BOOT = null;
			}, 10);
		('loading' !== doc.readyState) ? cb() : doc.addEventListener('DOMContentLoaded', cb);
	};
};
