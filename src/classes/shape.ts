import { XmlHelper } from '../helper/xml-helper';
import { GeneralHelper } from '../helper/general-helper';
import {
  ChartModificationCallback,
  ImportedElement,
  ShapeModificationCallback,
  ShapeTargetType,
  Target,
  Workbook,
} from '../types/types';
import { RootPresTemplate } from '../interfaces/root-pres-template';
import { XmlDocument, XmlElement } from '../types/xml-types';
import {
  ContentTypeExtension,
  ContentTypeMap,
} from '../enums/content-type-map';
import { ElementSubtype } from '../enums/element-type';
import IArchive from '../interfaces/iarchive';

export class Shape {
  mode: string;
  name: string;

  sourceArchive: IArchive;
  sourceSlideNumber: number;
  sourceSlideFile: string;
  sourceNumber: number;
  sourceFile: string;
  sourceRid: string;
  sourceElement: XmlElement;

  targetFile: string;
  targetArchive: IArchive;
  targetTemplate: RootPresTemplate;
  targetSlideNumber: number;
  targetNumber: number;
  targetSlideFile: string;
  targetSlideRelFile: string;

  createdRid: string;

  relRootTag: string;
  relAttribute: string;
  relParent: (element: XmlElement) => XmlElement;

  targetElement: XmlElement;
  targetType: ShapeTargetType;
  target: Target;

  callbacks: (ShapeModificationCallback | ChartModificationCallback)[];
  hasCreationId: boolean;
  contentTypeMap: typeof ContentTypeMap;
  subtype: ElementSubtype;

  constructor(shape: ImportedElement, targetType: ShapeTargetType) {
    this.mode = shape.mode;
    this.name = shape.name;
    this.targetType = targetType;

    this.sourceArchive = shape.sourceArchive;
    this.sourceSlideNumber = shape.sourceSlideNumber;
    this.sourceSlideFile = `ppt/slides/slide${this.sourceSlideNumber}.xml`;
    this.sourceElement = shape.sourceElement;
    this.hasCreationId = shape.hasCreationId;

    this.callbacks = GeneralHelper.arrayify(shape.callback);
    this.contentTypeMap = ContentTypeMap;

    if (shape.target) {
      this.sourceNumber = shape.target.number;
      this.sourceRid = shape.target.rId;
      this.subtype = shape.target.subtype;
      this.target = shape.target;
    }
  }

  async setTarget(
    targetTemplate: RootPresTemplate,
    targetSlideNumber: number,
  ): Promise<void> {
    const targetType = this.targetType;

    this.targetTemplate = targetTemplate;
    this.targetArchive = await this.targetTemplate.archive;
    this.targetSlideNumber = targetSlideNumber;
    this.targetSlideFile = `ppt/${targetType}s/${targetType}${this.targetSlideNumber}.xml`;
    this.targetSlideRelFile = `ppt/${targetType}s/_rels/${targetType}${this.targetSlideNumber}.xml.rels`;
  }

  async setTargetElement(): Promise<void> {
    this.targetElement = this.sourceElement.cloneNode(true) as XmlElement;
  }

  async appendToSlideTree(): Promise<void> {
    const targetSlideXml = await XmlHelper.getXmlFromArchive(
      this.targetArchive,
      this.targetSlideFile,
    );

    targetSlideXml
      .getElementsByTagName('p:spTree')[0]
      .appendChild(this.targetElement);

    XmlHelper.writeXmlToArchive(
      this.targetArchive,
      this.targetSlideFile,
      targetSlideXml,
    );
  }

  async replaceIntoSlideTree(): Promise<void> {
    await this.modifySlideTree(true);
  }

  async removeFromSlideTree(): Promise<void> {
    await this.modifySlideTree(false);
  }

  async modifySlideTree(insertBefore?: boolean): Promise<void> {
    const archive = this.targetArchive;
    const slideFile = this.targetSlideFile;

    const targetSlideXml = await XmlHelper.getXmlFromArchive(
      archive,
      slideFile,
    );

    const findMethod = this.hasCreationId ? 'findByCreationId' : 'findByName';

    const sourceElementOnTargetSlide = await XmlHelper[findMethod](
      targetSlideXml,
      this.name,
    );

    if (!sourceElementOnTargetSlide?.parentNode) {
      console.error(`Can't modify slide tree for ${this.name}`);
      return;
    }

    if (insertBefore === true) {
      sourceElementOnTargetSlide.parentNode.insertBefore(
        this.targetElement,
        sourceElementOnTargetSlide,
      );
    }

    sourceElementOnTargetSlide.parentNode.removeChild(
      sourceElementOnTargetSlide,
    );

    XmlHelper.writeXmlToArchive(archive, slideFile, targetSlideXml);
  }

  async updateElementsRelId(): Promise<void> {
    const targetSlideXml = await XmlHelper.getXmlFromArchive(
      this.targetArchive,
      this.targetSlideFile,
    );
    const targetElements = await this.getElementsByRid(
      targetSlideXml,
      this.sourceRid,
    );

    targetElements.forEach((targetElement: XmlElement) => {
      this.relParent(targetElement)
        .getElementsByTagName(this.relRootTag)[0]
        .setAttribute(this.relAttribute, this.createdRid);
    });

    XmlHelper.writeXmlToArchive(
      this.targetArchive,
      this.targetSlideFile,
      targetSlideXml,
    );
  }

  async getElementsByRid(
    slideXml: XmlDocument,
    rId: string,
  ): Promise<XmlElement[]> {
    const sourceList = slideXml
      .getElementsByTagName('p:spTree')[0]
      .getElementsByTagName(this.relRootTag);

    const sourceElements = XmlHelper.findByAttributeValue(
      sourceList,
      this.relAttribute,
      rId,
    );

    return sourceElements;
  }

  async updateTargetElementRelId(): Promise<void> {
    this.targetElement
      .getElementsByTagName(this.relRootTag)[0]
      .setAttribute(this.relAttribute, this.createdRid);
  }

  applyCallbacks(
    callbacks: ShapeModificationCallback[],
    element: XmlElement,
    arg1?: XmlElement,
  ): void {
    callbacks.forEach((callback) => {
      if (typeof callback === 'function') {
        try {
          callback(element, arg1);
        } catch (e) {
          console.warn(e);
        }
      }
    });
  }

  applyChartCallbacks(
    callbacks: ChartModificationCallback[],
    element: XmlElement,
    chart: XmlDocument,
    workbook: Workbook,
  ): void {
    callbacks.forEach((callback) => {
      if (typeof callback === 'function') {
        try {
          callback(element, chart, workbook);
        } catch (e) {
          console.warn(e);
        }
      }
    });
  }

  appendImageExtensionToContentType(
    extension: ContentTypeExtension,
  ): Promise<XmlElement | boolean> {
    return XmlHelper.appendImageExtensionToContentType(
      this.targetArchive,
      extension,
    );
  }
}
