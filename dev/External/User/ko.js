const ko = window.ko,

	rlContentType = 'snappymail/action',

	// In Chrome we have no access to dataTransfer.getData unless it's the 'drop' event
	// In Chrome Mobile dataTransfer.types.includes(rlContentType) fails, only text/plain is set
	getDragAction = () => dragData ? dragData.action : false,
	setDragAction = (e, action, effect, data, img) => {
		dragData = {
			action: action,
			data: data
		};
//		e.dataTransfer.setData(rlContentType, action);
		e.dataTransfer.setData('text/plain', rlContentType+'/'+action);
		e.dataTransfer.setDragImage(img, 0, 0);
		e.dataTransfer.effectAllowed = effect;
	},

	dragTimer = {
		id: 0,
		stop: () => clearTimeout(dragTimer.id),
		start: fn => dragTimer.id = setTimeout(fn, 500)
	};

let dragImage,
	dragData;

ko.bindingHandlers.editor = {
	init: (element, fValueAccessor) => {
		let editor = null;

		const fValue = fValueAccessor(),
			HtmlEditor = require('Common/HtmlEditor').default,
			fUpdateEditorValue = () => fValue && fValue.__editor && fValue.__editor.setHtmlOrPlain(fValue()),
			fUpdateKoValue = () => fValue && fValue.__editor && fValue(fValue.__editor.getDataWithHtmlMark()),
			fOnReady = () => {
				fValue.__editor = editor;
				fUpdateEditorValue();
			};

		if (ko.isObservable(fValue) && HtmlEditor) {
			editor = new HtmlEditor(element, fUpdateKoValue, fOnReady, fUpdateKoValue);

			fValue.__fetchEditorValue = fUpdateKoValue;

			fValue.subscribe(fUpdateEditorValue);

			// ko.utils.domNodeDisposal.addDisposeCallback(element, () => {
			// });
		}
	}
};

let ttn = (element, fValueAccessor) => require('Common/Momentor').timeToNode(element, ko.unwrap(fValueAccessor()));
ko.bindingHandlers.moment = {
	init: ttn,
	update: ttn
};

ko.bindingHandlers.emailsTags = {
	init: (element, fValueAccessor, fAllBindingsAccessor) => {
		const EmailModel = require('Model/Email').default,
			fValue = fValueAccessor(),
			fAllBindings = fAllBindingsAccessor(),
			inputDelimiters = [',', ';', '\n'];

		element.inputosaurus = new window.Inputosaurus(element, {
			focusCallback: value => fValue && fValue.focused && fValue.focused(!!value),
			autoCompleteSource: fAllBindings.autoCompleteSource || null,
			splitHook: value => {
				const v = value.trim();
				return (v && inputDelimiters.includes(v.substr(-1)))
					 ? EmailModel.splitEmailLine(value)
					 : null;
			},
			parseHook: input =>
				input.map(inputValue => {
					const values = EmailModel.parseEmailLine(inputValue);
					return values.length ? values : inputValue;
				}).flat(Infinity).map(
					item => (item.toLine ? [item.toLine(false), item] : [item, null])
				),
			onChange: value => {
				element.EmailsTagsValue = value;
				fValue(value);
			}
		});

		if (fValue && fValue.focused && fValue.focused.subscribe) {
			fValue.focused.subscribe(value =>
				element.inputosaurus[value ? 'focus' : 'blur']()
			);
		}
	},
	update: (element, fValueAccessor) => {
		const value = ko.unwrap(fValueAccessor());

		if (element.EmailsTagsValue !== value) {
			element.value = value;
			element.EmailsTagsValue = value;
			element.inputosaurus.refresh();
		}
	}
};

// Start dragging selected messages
ko.bindingHandlers.dragmessages = {
	init: (element, fValueAccessor) => {
		if (!rl.settings.app('mobile')) {
			element.addEventListener("dragstart", e => {
				let data = fValueAccessor()(e);
				dragImage || (dragImage = document.getElementById('messagesDragImage'));
				if (data && dragImage) {
					dragImage.querySelector('.text').textContent = data.uids.length;
					let img = dragImage.querySelector('.icon-white');
					img.classList.toggle('icon-copy', e.ctrlKey);
					img.classList.toggle('icon-mail', !e.ctrlKey);

					// Else Chrome doesn't show it
					dragImage.style.left = e.clientX + 'px';
					dragImage.style.top = e.clientY + 'px';
					dragImage.style.right = 'auto';

					setDragAction(e, 'messages', e.ctrlKey ? 'copy' : 'move', data, dragImage);

					// Remove the Chrome visibility
					dragImage.style.cssText = '';
				} else {
					e.preventDefault();
				}

			}, false);
			element.addEventListener("dragend", () => dragData = null);
			element.setAttribute('draggable', true);
		}
	}
};

// Drop selected messages on folder
ko.bindingHandlers.dropmessages = {
	init: (element, fValueAccessor) => {
		if (!rl.settings.app('mobile')) {
			const folder = fValueAccessor(),
//				folder = ko.dataFor(element),
				fnStop = e => {
					e.preventDefault();
					element.classList.remove('droppableHover');
					dragTimer.stop();
				},
				fnHover = e => {
					if ('messages' === getDragAction(e)) {
						fnStop(e);
						element.classList.add('droppableHover');
						if (folder && folder.collapsed()) {
							dragTimer.start(() => {
								folder.collapsed(false);
								rl.app.setExpandedFolder(folder.fullNameHash, true);
							}, 500);
						}
					}
				};
			element.addEventListener("dragenter", fnHover);
			element.addEventListener("dragover", fnHover);
			element.addEventListener("dragleave", fnStop);
			element.addEventListener("drop", e => {
				fnStop(e);
				if ('messages' === getDragAction(e) && ['move','copy'].includes(e.dataTransfer.effectAllowed)) {
					let data = dragData.data;
					if (folder && data && data.folder && Array.isArray(data.uids)) {
						rl.app.moveMessagesToFolder(data.folder, data.uids, folder.fullNameRaw, data.copy && e.ctrlKey);
					}
				}
			});
		}
	}
};

ko.bindingHandlers.sortableItem = {
	init: (element, fValueAccessor) => {
		let options = ko.unwrap(fValueAccessor()) || {},
			parent = element.parentNode,
			fnHover = e => {
				if ('sortable' === getDragAction(e)) {
					e.preventDefault();
					let node = (e.target.closest ? e.target : e.target.parentNode).closest('[draggable]');
					if (node && node !== dragData.data && parent.contains(node)) {
						let rect = node.getBoundingClientRect();
						if (rect.top + (rect.height / 2) <= e.clientY) {
							if (node.nextElementSibling !== dragData.data) {
								node.after(dragData.data);
							}
						} else if (node.previousElementSibling !== dragData.data) {
							node.before(dragData.data);
						}
					}
				}
			};
		element.addEventListener("dragstart", e => {
			dragData = {
				action: 'sortable',
				element: element
			};
			setDragAction(e, 'sortable', 'move', element, element);
			element.style.opacity = 0.25;
		});
		element.addEventListener("dragend", e => {
			element.style.opacity = null;
			if ('sortable' === getDragAction(e)) {
				dragData.data.style.cssText = '';
				let row = parent.rows[options.list.indexOf(ko.dataFor(element))];
				if (row != dragData.data) {
					row.before(dragData.data);
				}
				dragData = null;
			}
		});
		if (!parent.sortable) {
			parent.sortable = true;
			parent.addEventListener("dragenter", fnHover);
			parent.addEventListener("dragover", fnHover);
			parent.addEventListener("drop", e => {
				if ('sortable' === getDragAction(e)) {
					e.preventDefault();
					let data = ko.dataFor(dragData.data),
						from = options.list.indexOf(data),
						to = [...parent.children].indexOf(dragData.data);
					if (from != to) {
						let arr = options.list();
						arr.splice(to, 0, ...arr.splice(from, 1));
						options.list(arr);
					}
					dragData = null;
					options.afterMove && options.afterMove();
				}
			});
		}
	}
};

ko.bindingHandlers.link = {
	update: (element, fValueAccessor) => element.href = ko.unwrap(fValueAccessor())
};

ko.bindingHandlers.initDom = {
	init: (element, fValueAccessor) => fValueAccessor()(element)
};

ko.bindingHandlers.onEsc = {
	init: (element, fValueAccessor, fAllBindingsAccessor, viewModel) => {
		let fn = event => {
			if ('Escape' == event.key) {
				element.dispatchEvent(new Event('change'));
				fValueAccessor().call(viewModel);
			}
		};
		element.addEventListener('keyup', fn);
		ko.utils.domNodeDisposal.addDisposeCallback(element, () => element.removeEventListener('keyup', fn));
	}
};

// extenders

ko.extenders.specialThrottle = (target, timeout) => {
	timeout = parseInt(timeout, 10);
	if (0 < timeout) {
		let timer = 0,
			valueForRead = ko.observable(!!target()).extend({ throttle: 10 });

		return ko.computed({
			read: valueForRead,
			write: (bValue) => {
				if (bValue) {
					valueForRead(bValue);
				} else if (valueForRead()) {
					clearTimeout(timer);
					timer = setTimeout(() => {
						valueForRead(false);
						timer = 0;
					}, timeout);
				} else {
					valueForRead(bValue);
				}
			}
		});
	}

	return target;
};

export default ko;
