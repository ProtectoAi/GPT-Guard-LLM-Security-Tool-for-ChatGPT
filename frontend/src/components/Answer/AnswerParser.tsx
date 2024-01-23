import { AskResponse, Citation } from "../../api";
import { cloneDeep } from "lodash-es";


type ParsedAnswer = {
    citations: Citation[];
    markdownFormatText: string;
};

export function parseAnswer(answer: AskResponse): ParsedAnswer {
    let answerText = answer.answer;
    const citationLinks = answerText.match(/\[(doc\d\d?\d?)]/g);

    const lengthDocN = "[doc".length;

    let filteredCitations = [] as Citation[];
    let citationReindex = 0;
    citationLinks?.forEach(link => {
        let citationIndex = link.slice(lengthDocN, link.length - 1);
        let citation = cloneDeep(answer.citations[Number(citationIndex) - 1]) as Citation;
        if (!filteredCitations.find((c) => c.id === citationIndex)) {
          answerText = answerText.replaceAll(link, ` ^${++citationReindex}^ `);
          citation.id = citationIndex; 
          citation.reindex_id = citationReindex.toString();
          filteredCitations.push(citation);
        }
    })


    return {
        citations: filteredCitations,
        markdownFormatText: answerText
    };
}
