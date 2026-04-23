"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderOfferDocxFromDto = renderOfferDocxFromDto;
exports.renderOfferPdfFromDto = renderOfferPdfFromDto;
const fs_1 = require("fs");
const path = __importStar(require("path"));
const Docxtemplater = require("docxtemplater");
const PizZip = require("pizzip");
const libreoffice_pdf_1 = require("./libreoffice-pdf");
const offer_template_data_1 = require("./offer-template.data");
const offer_template_patch_xml_1 = require("./offer-template.patch-xml");
const patchedZips = {};
function shrinkXmlFontSizes(xml) {
    const scale = (raw) => {
        const n = Number.parseInt(raw, 10);
        if (!Number.isFinite(n) || n <= 0)
            return raw;
        const shrunk = Math.max(18, Math.round(n * 0.85));
        return String(shrunk);
    };
    return xml
        .replace(/<w:sz w:val="(\d+)"\s*\/>/g, (_m, v) => {
        return `<w:sz w:val="${scale(v)}"/>`;
    })
        .replace(/<w:szCs w:val="(\d+)"\s*\/>/g, (_m, v) => {
        return `<w:szCs w:val="${scale(v)}"/>`;
    });
}
function templatePath(variant) {
    const file = variant === 'platforms'
        ? 'offer-platforms-template.docx'
        : 'offer-po-template.docx';
    return path.join(process.cwd(), 'templates', file);
}
function getPatchedTemplateZip(variant) {
    const cached = patchedZips[variant];
    if (cached)
        return cached;
    const zip = new PizZip((0, fs_1.readFileSync)(templatePath(variant)));
    const f = zip.file('word/document.xml');
    if (!f)
        throw new Error('В шаблоне нет word/document.xml');
    let xml = f.asText();
    xml = (0, offer_template_patch_xml_1.patchOfferTemplateXml)(xml);
    xml = shrinkXmlFontSizes(xml);
    zip.file('word/document.xml', xml);
    const styles = zip.file('word/styles.xml');
    if (styles) {
        const stylesXml = shrinkXmlFontSizes(styles.asText());
        zip.file('word/styles.xml', stylesXml);
    }
    const buf = zip.generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
    });
    patchedZips[variant] = buf;
    return buf;
}
function renderOfferDocxFromDto(dto, variant = 'po') {
    const zip = new PizZip(getPatchedTemplateZip(variant));
    const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: '[[', end: ']]' },
    });
    try {
        doc.render((0, offer_template_data_1.offerDtoToTemplateData)(dto));
    }
    catch (e) {
        const err = e;
        throw new Error(`Ошибка заполнения шаблона: ${JSON.stringify(err.properties?.errors ?? err)}`);
    }
    return doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
    });
}
async function renderOfferPdfFromDto(dto, variant = 'po') {
    const docx = renderOfferDocxFromDto(dto, variant);
    return (0, libreoffice_pdf_1.convertDocxBufferToPdf)(docx);
}
//# sourceMappingURL=offer-template.engine.js.map