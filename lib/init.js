

/** 
 * Imports a template as a Document which we can then modify and display
 * @param { String } basePath
 * @param { String } name
 * @returns { Document }
 */
async function importTemplate (basePath, name) {
    let text = await fetch(basePath + "/" + name).then((response) => {
        if (response.ok) { return response.text() }
        throw response;
    });
    let parser = new DOMParser();
    return parser.parseFromString(text, "text/html");
}

/**
 * Searches the template that container placeholders marked inside the provided markIn and markOut,
 * replaces them with the data provided and returns the string
 * @param { String } template 
 * @param { Object } data 
 * @param { String } markIn
 * @param { String } markOut
 * @returns { String }
 */
function fillTemplate (template, data, markIn, markOut) {
    let s = template;
    // The following regex will match all strings wrapped in {curly brackets} while excluding the curly brackets.
    let regex = new RegExp("(?<=\\"+markIn+").*?(?=\\"+markOut+")", "g")
    let matches = s.match(regex);
    console.debug("regex matched " + matches + " len " + matches.length);
    for (let i = 0 ; i < matches.length ; i++) {
        if (data[matches[i]] == undefined) {
            console.warn(`No data defined to fill template placeholder ${matches[i]}, skipping`);
            continue;
        }
        s = s.replace(`${markIn}${matches[i]}${markOut}`, data[matches[i]]);
    }
    return s;
}

/**
 * Util function to append a list of nodes to another node
 * @param { Node } node
 * @param { NodeListOf<ChildNode> } nodeList
 */
function appendNodeList (node, nodeList) {
    // we cannot use forEach as the nodeList's length may change
    for (let i = 0 ; i < nodeList.length ; i++) {
        // we clone the node to avoid removing it from the nodelist
        node.appendChild(nodeList[i].cloneNode(true));
    }
}

/**
 * Looks for any words in the provided HTMLElement that contain terminology marked inside [square brackets]
 * and replaces them with hoverable and clickable links to their definitions
 * @param { HTMLElement } element
 * @param { Map<String, Map<String, String>> } terms 
 */
// const fillTerminology = (element, terms) => {
//     // The following regex will match all strings wrapped in [square brackets] while excluding the square brackets.
//     let matches = element.innerText.match(/(?<=\[).*?(?=\])/);
//     for (const match in matches) {
//         let definition = terms.get(match);
//         if (definition == undefined) {
//             console.warn("Match ["+match+"] was not found in known terminology, skipping");
//             continue;
//         }
//         element.innerHTML = element.innerHTML.replace("["+match+"]", definition);
//     }
// };

class ComplicatedForm {
    /**
     * Create a new instance of ComplicatedForm. The basePath should be the
     * location of the root of the library on the server (e.g. /lib).
     * This assumes that templates are placed in /templates and data/config
     * files are placed in /config.
     * @param { Document } dom
     * @param { String } basePath 
     */
    constructor(dom, basePath) {
        this.document = dom;
        this.basePath = basePath;
        console.debug("ComplicatedForm constructed with basePath " + basePath);

        this.document.addEventListener("DOMContentLoaded", async () => {
            // load templates and config to avoid fetching them later
            this.questionTemplate = await importTemplate(basePath, "templates/question.html");
            this.optionTemplate = await importTemplate(basePath, "templates/option.html");
            this.confirmTemplate = await importTemplate(basePath, "templates/confirm.html");
            this.textinputTemplate = await importTemplate(basePath, "templates/text_input.html");
            this.definitionTemplate = await importTemplate(basePath, "templates/definition.html");

            this.structure = await (await fetch(basePath+"/config/structure.json")).json();
            this.terminology = await (await fetch(basePath+"/config/terminology.json")).json();

            console.debug("ComplicatedForm loaded all templates and config successfully.");

            // Try to import all the questions in the form structure into a HashMap with their IDs
            /** @type { Map<String, Question> } */
            this.questions = new Map();
            for (let q in this.structure.questions) {
                try {
                    this.questions.set(q, Question.fromJson(this.structure.questions[q], this.questionTemplate, this.optionTemplate, this.confirmTemplate, this.textinputTemplate, this.definitionTemplate, this.terminology));
                } catch(e) {
                    console.warn(e);
                }
            }

            // Try to display the first question
            try {
                console.log(this.questions);
                console.log(this.structure);
                console.log(this.structure.start);
                console.log(this.questions.get("0"));
                console.log(this.questions.get(this.structure.start).render());

                appendNodeList(
                    this.document.getElementById("questions"), 
                    this.questions.get(this.structure.start).render());

                // Enable tooltips because Bootstrap says we need to 
                const tooltipTriggers = this.document.querySelectorAll("[rel=tooltip]");
                const tooltipList = [...tooltipTriggers].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
            } catch(e) {
                console.warn(e);
            }

            // Remove the loading spinner, if it doesn't exist then no nothing
            try {
                this.document.getElementById("loading").innerHTML = "";
            } catch {}
        });
    }

    //test function
    createQuestion() {
        console.log(Question.fromJson(
            this.structure["questions"]["0"],
            this.questionTemplate,
            this.optionTemplate,
            this.textinputTemplate,
            this.definitionTemplate,
            this.terminology,
        ));
    }

    // test function
    // delete this
    addQuestion() {
        // Clone the templates so we do not modify the ones we have cached
        let questionTemplate = this.questionTemplate.cloneNode(true);
        let definitionTemplate = this.definitionTemplate.cloneNode(true);
        let terminology = structuredClone(this.terminology);

        questionTemplate.body.innerHTML = fillTemplate(questionTemplate.body.innerHTML, {"title": "Hello World!", "content": "[invasive] content here"}, "{", "}");
        
        // now we need to parse the terms into html so we can fill the placeholders
        let termsParsed = new Object;
        for (const term in terminology) {
            termsParsed[term] = fillTemplate(definitionTemplate.body.innerHTML, {
                "text": term,
                "definition": terminology[term]["definition"],
                "link": "#"
            }, "{", "}");
        }

        // Now replace the placeholders with hoverable links to the terms
        questionTemplate.body.innerHTML = fillTemplate(questionTemplate.body.innerHTML, termsParsed, "[", "]");

        // Make sure we enable the tooltips (Bootstrap requires this)
        const tooltipTriggers = questionTemplate.querySelectorAll("[rel=tooltip]");
        const tooltipList = [...tooltipTriggers].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));

        this.document.getElementById("questions").appendChild(questionTemplate.body);
    }
}
