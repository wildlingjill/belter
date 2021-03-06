var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/* @jsx jsxToHTML */

import { regexMap, svgToBase64, regexTokenize } from './util';
import { fixScripts, setStyle, writeToWindow, writeElementToWindow, appendChild } from './dom';

var JSX_EVENTS = {
    onClick: 'click'
};

// eslint-disable-next-line no-use-before-define


function htmlEncode() {
    var html = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';

    return html.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/\//g, '&#x2F;');
}

export var JsxHTMLNode = function () {
    function JsxHTMLNode(name, props, children) {
        _classCallCheck(this, JsxHTMLNode);

        this.name = name;
        this.props = props;
        this.children = children;
    }

    JsxHTMLNode.prototype.toString = function toString() {
        var name = this.name;
        var props = this.propsToString();
        var children = this.childrenToString();

        return '<' + name + (props ? ' ' : '') + props + '>' + children + '</' + name + '>';
    };

    JsxHTMLNode.prototype.propsToString = function propsToString() {
        var props = this.props;

        if (!props) {
            return '';
        }

        return Object.keys(props).filter(function (key) {
            return key !== 'innerHTML' && props && props[key] !== false;
        }).map(function (key) {
            if (props) {
                var val = props[key];

                if (val === true) {
                    return '' + htmlEncode(key);
                }

                if (typeof val === 'string') {
                    return htmlEncode(key) + '="' + htmlEncode(val) + '"';
                }
            }
            return '';
        }).filter(Boolean).join(' ');
    };

    JsxHTMLNode.prototype.childrenToString = function childrenToString() {

        if (this.props && this.props.innerHTML) {
            return this.props.innerHTML;
        }

        if (!this.children) {
            return '';
        }

        var result = '';

        function iterate(children) {
            for (var _i2 = 0, _length2 = children == null ? 0 : children.length; _i2 < _length2; _i2++) {
                var child = children[_i2];

                if (child === null || child === undefined) {
                    continue;
                }

                if (Array.isArray(child)) {
                    iterate(child);
                } else if (child instanceof JsxHTMLNode) {
                    result += child.toString();
                } else {
                    result += htmlEncode(child);
                }
            }
        }

        iterate(this.children);

        return result;
    };

    return JsxHTMLNode;
}();

export var JsxHTMLNodeContainer = function (_JsxHTMLNode) {
    _inherits(JsxHTMLNodeContainer, _JsxHTMLNode);

    function JsxHTMLNodeContainer(children) {
        _classCallCheck(this, JsxHTMLNodeContainer);

        return _possibleConstructorReturn(this, _JsxHTMLNode.call(this, '', {}, children));
    }

    JsxHTMLNodeContainer.prototype.toString = function toString() {
        return this.childrenToString();
    };

    return JsxHTMLNodeContainer;
}(JsxHTMLNode);

export function jsxToHTML(element) {
    var props = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    for (var _len = arguments.length, children = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
        children[_key - 2] = arguments[_key];
    }

    if (typeof element === 'string') {
        return new JsxHTMLNode(element, props, children);
    }

    if (typeof element === 'function') {
        return element(props, children);
    }

    throw new TypeError('Expected jsx Element to be a string or a function');
}

export function jsxRender(template, renderers) {

    // eslint-disable-next-line security/detect-unsafe-regex
    var nodes = regexMap(template, /\{\s*([a-z]+)(?::\s*([^} ]+))?\s*\}|([^${}]+)/g, function (match, type, value, text) {
        if (type) {
            if (!renderers[type]) {
                throw new Error('Can not render type: ' + type);
            }

            return renderers[type](value);
        } else if (text && text.trim()) {

            if (!renderers.text) {
                return text;
            }

            if (/<br>/.test(text)) {
                return renderers['break'](text);
            } else {
                return renderers.text(text);
            }
        } else {
            return text;
        }
    });

    return new JsxHTMLNodeContainer(nodes);
}

export function Fragment(props, children) {
    return new JsxHTMLNodeContainer(children);
}

export function SVG(props) {
    var svg = props.svg,
        otherProps = _objectWithoutProperties(props, ['svg']);

    if (!svg) {
        throw new TypeError('Expected svg prop');
    }

    if (typeof svg !== 'string' && !(svg instanceof JsxHTMLNode)) {
        throw new TypeError('Expected svg prop to be a string or jsx html node');
    }

    return jsxToHTML('img', _extends({ src: svgToBase64(svg.toString()) }, otherProps));
}

export function placeholderToJSX(text, placeholders) {
    return regexTokenize(text, /(\{[a-z]+\})|([^{}]+)/g).map(function (token) {
        var match = token.match(/^{([a-z]+)}$/);
        if (match) {
            return placeholders[match[1]]();
        } else if (placeholders.text) {
            return placeholders.text(token);
        } else {
            return token;
        }
    });
}

export function jsxDom(element, props) {
    for (var _len2 = arguments.length, children = Array(_len2 > 2 ? _len2 - 2 : 0), _key2 = 2; _key2 < _len2; _key2++) {
        children[_key2 - 2] = arguments[_key2];
    }

    if (typeof element === 'function') {
        return element(props, children);
    }

    var name = element.toLowerCase();

    var doc = this && this.createElement ? this : window.document;

    var el = doc.createElement(name);

    for (var prop in props) {
        if (prop in JSX_EVENTS) {
            el.addEventListener(JSX_EVENTS[prop], props[prop]);
        } else if (prop === 'innerHTML') {
            el.innerHTML = props[prop];
            fixScripts(el, doc);
        } else {
            el.setAttribute(prop, props[prop]);
        }
    }

    var content = children[0],
        remaining = children.slice(1);


    if (name === 'style') {

        if (typeof content !== 'string') {
            throw new TypeError('Expected ' + name + ' tag content to be string, got ' + (typeof content === 'undefined' ? 'undefined' : _typeof(content)));
        }

        if (remaining.length) {
            throw new Error('Expected only text content for ' + name + ' tag');
        }

        setStyle(el, content, doc);
    } else if (name === 'iframe') {

        if (remaining.length) {
            throw new Error('Expected only single child node for iframe');
        }

        el.addEventListener('load', function () {
            var win = el.contentWindow;

            if (!win) {
                throw new Error('Expected frame to have contentWindow');
            }

            if (typeof content === 'string') {
                writeToWindow(win, content);
            } else {
                writeElementToWindow(win, content);
            }
        });
    } else if (name === 'script') {

        if (typeof content !== 'string') {
            throw new TypeError('Expected ' + name + ' tag content to be string, got ' + (typeof content === 'undefined' ? 'undefined' : _typeof(content)));
        }

        if (remaining.length) {
            throw new Error('Expected only text content for ' + name + ' tag');
        }

        el.text = content;
    } else {
        for (var i = 0; i < children.length; i++) {
            if (typeof children[i] === 'string') {
                var textNode = doc.createTextNode(children[i]);
                appendChild(el, textNode);
            } else {
                appendChild(el, children[i]);
            }
        }
    }

    return el;
}