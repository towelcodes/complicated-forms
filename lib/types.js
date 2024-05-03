class QuestionChangeLogic {

}

// /**
//  * @abstract
//  */
// class FromJson {
//     constructor() {
//         if (this.constructor == FromJson) {
//             throw new Error("Abstract classes can't be instantiated.");
//         }
//     }

//     /**
//      * @abstract
//      * @param { Object } _
//      */
//     static fromJson(_) {
//         throw new Error("Not implemented");
//     }
// }

/**
 * This should really be an interface but apparently JS doesn't have those
 * @abstract
 */
class Renderable {
    /**
     * Base class for an Renderable
     * @param { Document } template 
     */
    constructor(template) {
        if (this.constructor == Renderable) {
            throw new Error("Abstract classes can't be instantiated.");
        }
        this.template = template;
    }

    /**
     * @returns { NodeListOf<ChildNode> } 
     */
    render() {
        throw new Error("Not implemented");
    }
}

/**
 * Base class for answer formats
 * @abstract
 */
class AnswerFormat extends Renderable {
    /** @param { Document } template */
    constructor(template) {
        super(template);
        if (this.constructor == AnswerFormat) {
            throw new Error("Abstract classes can't be instantiated.");
        }
    }

    /**
     * @returns { NodeListOf<ChildNode> }
     */
    render() {
        throw new Error("Not implemented");
    }

    /**
     * Get the current value
     * @returns { String[] }
     */
    getState() {
        throw new Error("Not implemented");
    }

    /**
     * Add a function that should be called when the answer is submitted
     * The function will be called with a String[] of the current value
     * @param { Function } runnable 
     */
    addCallback(runnable) {
        throw new Error("Not implemented");
    }
}

class Question extends Renderable {
    /**
     * Creates a Question.
     * @param { String } title 
     * @param { ?String } description  Description may be null if none is avaliable.
     * @param { AnswerFormat } format
     * @param { Object<String, String> } next 
     * @param { Document } template
     * @param { Document } definitionTemplate
     * @param { ?Object<String, String> } specialWords Special words that will be replaced if found in [square brackets]. Can be null if none.
     */
    constructor(title, description, format, next, template, definitionTemplate, specialWords) {
        super(template);
        this.title = title;
        this.description = description;
        this.format = format;
        this.next = next;
        this.definitionTemplate = definitionTemplate;
        this.specialWords = specialWords;

        // Tell the AnswerFormat to call this stateConfirm function when the value is confirmed
        this.format.addCallback(this.stateConfirm);
    }

    /**
     * Attempts to parse an Object into a Question
     * @param { Object } obj Object to parse
     * @param { Document } questionTemplate
     * @param { Document } selectTemplate
     * @param { Document } confirmTemplate
     * @param { Document } textinputTemplate
     * @param { Document } definitionTemplate
     * @param { ?Object<String, String> } specialWords
     * @returns { Question }
     */
    static fromJson(obj, questionTemplate, selectTemplate, confirmTemplate, textinputTemplate, definitionTemplate, specialWords) {
        // We need to work out the correct AnswerFormat create it with the provide options
        /** @type { AnswerFormat } */
        let format;
        switch (obj.format.type) {
            case "select":
                format = new SelectAnswerFormat(
                    selectTemplate,
                    obj.format.multiple,
                    obj.format.options,
                    confirmTemplate
                );
                break;
            case "text":
                format = new TextAnswerFormat(
                    textinputTemplate
                );
            default:
                throw new Error(`Unknown answer format: ${obj.format}`);
        }

        return new Question(
            obj.title,
            obj.description || null,
            format,
            obj.next,
            questionTemplate,
            definitionTemplate,
            specialWords
        );
    }

    /**
     * Utility method that looks for [special words] in the provided string and replaces them
     * with the filled template. This will not enable tooltips
     * @param { String } input
     * @param { Object } words
     * @param { Document } template
     * @returns { String }
     */
    static #fillSpecialWords(input, words, template) {
        let wordsParsed = new Object;
        for (const word in words) {
            wordsParsed[word] = fillTemplate(template.body.innerHTML, {
                "text": word,
                "definition": words[word].definition,
                "link": words[word].link || "#",
            }, "{", "}");
        }
        return fillTemplate(input, wordsParsed, "[", "]");
    }

    /**
     * This will be called when the state is confirmed.
     * It should somehow tell the parent ComplicatedForm to display the next question
     * @param { String[] } state 
     */
    stateConfirm(state) {
        console.log(`state confirmed: ${state}`);
    }

    /**
     * Populates the template and returns it
     * @returns { NodeListOf<ChildNode> }
     */
    render() {
        // Create a clone of the template so we do not modify the original
        /** @type { Document } */
        let template = this.template.cloneNode(true);
        template.body.innerHTML = fillTemplate(template.body.innerHTML, {"title": "Hello World!", "content": "More [invasive] content here"}, "{", "}");
        template.body.innerHTML = Question.#fillSpecialWords(template.body.innerHTML, this.specialWords, this.definitionTemplate);

        appendNodeList(template.getElementById("options"), this.format.render());

        return template.body.childNodes;
    }
}



class SelectAnswerFormat extends AnswerFormat {
    /**
     * @param { Document } template
     * @param { Boolean } multiple 
     * @param { Array<String> } options 
     * @param { ?Document } confirmTemplate
     */
    constructor(template, multiple, options, confirmTemplate=null) {
        super(template);

        /** @type { String[] } */
        this.state = [];
        /** @type { Function[] } */
        this.callbacks = [];

        this.multiple = multiple;
        this.options = options;
        this.confirmTemplate = confirmTemplate;
    }

    /**
     * Gets the current value
     * @returns { String[] }
     */
    getState() {
        return this.state;
    }

    /**
     * Add a function that should be called when the answer is submitted
     * The function will be called with a String[] of the current value
     * @param { Function } runnable 
     */
    addCallback(runnable) {
        this.callbacks.push(runnable);
    }

    /**
     * Will be called when buttons are clicked
     * @param { String } name
     */
    clicked(name) {
        console.log(`cliciked ${name}`);
    }

    /**
     * Populates the template and returns the result
     * @returns { NodeListOf<ChildNode> }
     */
    render() {
        /** @type { Array<NodeListOf<ChildNode>> } */
        let selections = [];
        // For each option, we need to clone the template and add the name of that option

        for (let option in this.options) {
            /** @type { Document } */
            let template = this.template.cloneNode(true);
            template.body.innerHTML = fillTemplate(template.body.innerHTML, { "name": this.options[option] }, "{", "}");

            // Add a click listener to all the options
            let clickableElements = template.getElementsByClassName("clickable");
            console.log(`clickableElements : ${clickableElements.length}`);
            console.log(clickableElements);
            for (let i = 0 ; i < clickableElements.length ; i++) {
                console.log(`adding click listener for opt ${this.options[option]}`);
                console.log(clickableElements[i]);
                console.log(typeof clickableElements[i]);
                console.log(clickableElements[i] instanceof Element);

                clickableElements[i].addEventListener("click", (e) => { 
                    console.log(e); 
                    this.clicked(this.options[option]); 
                });
            }

            selections.push(template.body.childNodes);
        }

        // messy solution to create a Document instance
        // there it probably a better way to do this
        let parser = new DOMParser();
        let doc = parser.parseFromString("<html>", "text/html");

        // add all the options to the Document we created
        for (let i = 0 ; i < selections.length ; i++) {
            appendNodeList(doc.body, selections[i]);
        }

        // if multiple choice is enabled, we also need to add a "confirm" button
        if (this.multiple) {
            try {
                appendNodeList(doc.body, this.confirmTemplate.body.childNodes);
            } catch(e) {
                console.error("Failed to add confirm button because the template could not be found");
            }
        }

        return doc.body.childNodes;
    }
}

class TextAnswerFormat extends Renderable {
    /**
     * @param { Document } template
     */
    constructor(template) {
        this.template = template;
    }

    /**
     * @returns { NodeListOf<ChildNode> }
     */
    render() {
        // placeholder
        return new HTMLDivElement();
    }
}