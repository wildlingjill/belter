/* @flow */
/* @jsx jsxToHTML */

import { regexMap, svgToBase64, regexTokenize } from './util';
import { fixScripts, setStyle, writeToWindow, writeElementToWindow, appendChild } from './dom';

const JSX_EVENTS = {
    onClick: 'click'
};

// eslint-disable-next-line no-use-before-define
type ChildType = $ReadOnlyArray<ChildType> | JsxHTMLNode | string | void | null;
export type ChildrenType = $ReadOnlyArray<ChildType>;

export type PropsType = {
    class? : string,
    id? : string,
    innerHTML? : string,
    [string] : mixed
};

function htmlEncode(html : string = '') : string {
    return html.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/\//g, '&#x2F;');
}

export class JsxHTMLNode {
    name : string
    props : ?PropsType
    children : ChildrenType

    constructor(name : string, props : ?PropsType, children : ChildrenType) {
        this.name = name;
        this.props = props;
        this.children = children;
    }

    toString() : string {
        let name = this.name;
        let props = this.propsToString();
        let children = this.childrenToString();

        return `<${ name }${ props ? ' ' : '' }${ props }>${ children }</${ name }>`;
    }

    propsToString() : string {
        let props = this.props;

        if (!props) {
            return '';
        }

        return Object.keys(props).filter(key => {
            return key !== 'innerHTML' && props && props[key] !== false;
        }).map(key => {
            if (props) {
                let val = props[key];

                if (val === true) {
                    return `${ htmlEncode(key) }`;
                }

                if (typeof val === 'string') {
                    return `${ htmlEncode(key) }="${ htmlEncode(val) }"`;
                }
            }
            return '';
        }).filter(Boolean).join(' ');
    }

    childrenToString() : string {

        if (this.props && this.props.innerHTML) {
            return this.props.innerHTML;
        }

        if (!this.children) {
            return '';
        }

        let result = '';

        function iterate(children) {
            for (let child of children) {

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
    }
}

export class JsxHTMLNodeContainer extends JsxHTMLNode {


    constructor(children : ChildrenType) {
        super('', {}, children);
    }

    toString() : string {
        return this.childrenToString();
    }
}

export function jsxToHTML(element : mixed, props : ?PropsType = {}, ...children : ChildrenType) : JsxHTMLNode {
    if (typeof element === 'string') {
        return new JsxHTMLNode(element, props, children);
    }

    if (typeof element === 'function') {
        return element(props, children);
    }
    
    throw new TypeError(`Expected jsx Element to be a string or a function`);
}

export function jsxRender(template : string, renderers : { [string] : (string) =>?(JsxHTMLNode | Array<JsxHTMLNode>) }) : JsxHTMLNode {

    // eslint-disable-next-line security/detect-unsafe-regex
    let nodes = regexMap(template, /\{\s*([a-z]+)(?::\s*([^} ]+))?\s*\}|([^${}]+)/g, (match, type, value, text) => {
        if (type) {
            if (!renderers[type]) {
                throw new Error(`Can not render type: ${ type }`);
            }

            return renderers[type](value);
        } else if (text && text.trim()) {

            if (!renderers.text) {
                return text;
            }

            if (/<br>/.test(text)) {
                return renderers.break(text);
            } else {
                return renderers.text(text);
            }
        } else {
            return text;
        }
    });

    return new JsxHTMLNodeContainer(nodes);
}

export function Fragment(props : PropsType, children : ChildrenType) : JsxHTMLNode {
    return new JsxHTMLNodeContainer(children);
}

export function SVG(props : PropsType) : JsxHTMLNode {
    let { svg, ...otherProps } = props;

    if (!svg) {
        throw new TypeError(`Expected svg prop`);
    }

    if (typeof svg !== 'string' && !(svg instanceof JsxHTMLNode)) {
        throw new TypeError(`Expected svg prop to be a string or jsx html node`);
    }

    return (
        <img src={ svgToBase64(svg.toString()) } { ...otherProps } />
    );
}

export function placeholderToJSX(text : string, placeholders : { [string] : (?string) => JsxHTMLNode | string }) : Array<string | JsxHTMLNode> {
    return regexTokenize(text, /(\{[a-z]+\})|([^{}]+)/g)
        .map(token => {
            let match = token.match(/^{([a-z]+)}$/);
            if (match) {
                return placeholders[match[1]]();
            } else if (placeholders.text) {
                return placeholders.text(token);
            } else {
                return token;
            }
        });
}


export function jsxDom(element : string | Function, props : ?{ [string] : mixed }, ...children : Array<string | HTMLElement>) : HTMLElement {

    if (typeof element === 'function') {
        return element(props, children);
    }

    let name = element.toLowerCase();

    let doc = (this && this.createElement)
        ? this
        : window.document;

    let el = doc.createElement(name);

    for (let prop in props) {
        if (prop in JSX_EVENTS) {
            el.addEventListener(JSX_EVENTS[prop], props[prop]);
        } else if (prop === 'innerHTML') {
            el.innerHTML = props[prop];
            fixScripts(el, doc);
        } else {
            el.setAttribute(prop, props[prop]);
        }
    }

    let [ content, ...remaining ] = children;

    if (name === 'style') {

        if (typeof content !== 'string') {
            throw new TypeError(`Expected ${ name } tag content to be string, got ${ typeof content }`);
        }

        if (remaining.length) {
            throw new Error(`Expected only text content for ${ name } tag`);
        }

        setStyle(el, content, doc);

    } else if (name === 'iframe') {

        if (remaining.length) {
            throw new Error(`Expected only single child node for iframe`);
        }

        el.addEventListener('load', () => {
            let win = el.contentWindow;

            if (!win) {
                throw new Error(`Expected frame to have contentWindow`);
            }

            if (typeof content === 'string') {
                writeToWindow(win, content);
            } else {
                writeElementToWindow(win, content);
            }
        });

    } else if (name === 'script') {

        if (typeof content !== 'string') {
            throw new TypeError(`Expected ${ name } tag content to be string, got ${ typeof content }`);
        }

        if (remaining.length) {
            throw new Error(`Expected only text content for ${ name } tag`);
        }

        el.text = content;

    } else {
        for (let i = 0; i < children.length; i++) {
            if (typeof children[i] === 'string') {
                let textNode = doc.createTextNode(children[i]);
                appendChild(el, textNode);
            } else {
                appendChild(el, children[i]);
            }
        }
    }

    return el;
}
