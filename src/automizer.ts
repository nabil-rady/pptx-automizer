import { Slide } from './classes/slide';
import { FileHelper } from './helper/file-helper';
import {
  AutomizerParams,
  AutomizerSummary,
  SourceSlideIdentifier,
  StatusTracker,
} from './types/types';
import { IPresentationProps } from './interfaces/ipresentation-props';
import { PresTemplate } from './interfaces/pres-template';
import { RootPresTemplate } from './interfaces/root-pres-template';
import { Template } from './classes/template';
import { TemplateInfo } from './types/xml-types';
import { vd } from './helper/general-helper';
import { Master } from './classes/master';
import path from 'path';
import * as fs from 'fs';

/**
 * Automizer
 *
 * The basic class for `pptx-automizer` package.
 * This class will be exported as `Automizer` by `index.ts`.
 */
export default class Automizer implements IPresentationProps {
  rootTemplate: RootPresTemplate;
  /**
   * Templates  of automizer
   * @internal
   */
  templates: PresTemplate[];
  templateDir: string;
  templateFallbackDir: string;
  outputDir: string;
  /**
   * Timer  of automizer
   * @internal
   */
  timer: number;
  params: AutomizerParams;
  status: StatusTracker;

  /**
   * Creates an instance of `pptx-automizer`.
   * @param [params]
   */
  constructor(params: AutomizerParams) {
    this.templates = [];
    this.params = params;

    this.templateDir = params?.templateDir ? params.templateDir + '/' : '';
    this.templateFallbackDir = params?.templateFallbackDir
      ? params.templateFallbackDir + '/'
      : '';
    this.outputDir = params?.outputDir ? params.outputDir + '/' : '';

    this.timer = Date.now();
    this.setStatusTracker(params?.statusTracker);

    if (params.rootTemplate) {
      const location = this.getLocation(params.rootTemplate, 'template');
      this.rootTemplate = Template.import(location) as RootPresTemplate;
    }

    if (params.presTemplates) {
      this.params.presTemplates.forEach((file) => {
        const location = this.getLocation(file, 'template');
        const newTemplate = Template.import(location, file) as PresTemplate;
        this.templates.push(newTemplate);
      });
    }
  }

  setStatusTracker(statusTracker: StatusTracker['next']): void {
    const defaultStatusTracker = (status: StatusTracker) => {
      console.log(status.info + '(' + status.share + '%)');
    };

    this.status = {
      current: 0,
      max: 0,
      share: 0,
      info: undefined,
      increment: () => {
        this.status.current++;
        const nextShare =
          this.status.max > 0
            ? Math.round((this.status.current / this.status.max) * 100)
            : 0;

        if (this.status.share !== nextShare) {
          this.status.share = nextShare;
          this.status.next(this.status);
        }
      },
      next: statusTracker || defaultStatusTracker,
    };
  }

  /**

   */
  public async presentation(): Promise<this> {
    if (this.params?.useCreationIds === true) {
      await this.setCreationIds();
    }
    return this;
  }

  /**
   * Load a pptx file and set it as root template.
   * @param location - Filename or path to the template. Will be prefixed with 'templateDir'
   * @returns Instance of Automizer
   */
  public loadRoot(location: string): this {
    return this.loadTemplate(location);
  }

  /**
   * Load a template pptx file.
   * @param location - Filename or path to the template. Will be prefixed with 'templateDir'
   * @param name - Optional: A short name for the template. If skipped, the template will be named by its location.
   * @returns Instance of Automizer
   */
  public load(location: string, name?: string): this {
    name = name === undefined ? location : name;
    return this.loadTemplate(location, name);
  }

  /**
   * Loads a pptx file either as a root template as a template file.
   * A name can be specified to give templates an alias.
   * @param location
   * @param [name]
   * @returns template
   */
  private loadTemplate(location: string, name?: string): this {
    location = this.getLocation(location, 'template');
    const alreadyLoaded = this.templates.find(
      (template) => template.name === name,
    );
    if (alreadyLoaded) {
      return this;
    }

    const newTemplate = Template.import(location, name);

    if (!this.isPresTemplate(newTemplate)) {
      this.rootTemplate = newTemplate;
    } else {
      this.templates.push(newTemplate);
    }

    return this;
  }

  /**
   * Parses all loaded templates and collects creationIds for slides and
   * elements. This will make finding templates and elements independent
   * from slide number and element name.
   * @returns Promise<TemplateInfo[]>
   */
  public async setCreationIds(): Promise<TemplateInfo[]> {
    const templateCreationId = [];
    for (const template of this.templates) {
      const creationIds =
        template.creationIds || (await template.setCreationIds());
      templateCreationId.push({
        name: template.name,
        slides: creationIds,
      });
    }
    return templateCreationId;
  }

  /**
   * Determines whether template is root or default template.
   * @param template
   * @returns pres template
   */
  private isPresTemplate(
    template: PresTemplate | RootPresTemplate,
  ): template is PresTemplate {
    return 'name' in template;
  }

  /**
   * Add a slide from one of the imported templates by slide number or creationId.
   * @param name - Name or alias of the template; must have been loaded with `Automizer.load()`
   * @param slideIdentifier - Number or creationId of slide in template presentation
   * @param callback - Executed after slide was added. The newly created slide will be passed to the callback as first argument.
   * @returns Instance of Automizer
   */
  public addSlide(
    name: string,
    slideIdentifier: SourceSlideIdentifier,
    callback?: (slide: Slide) => void,
  ): this {
    if (this.rootTemplate === undefined) {
      throw new Error('You have to set a root template first.');
    }

    const template = this.getTemplate(name);

    const newSlide = new Slide({
      presentation: this,
      template,
      slideIdentifier,
    });

    if (callback !== undefined) {
      newSlide.root = this;
      callback(newSlide);
    }

    this.rootTemplate.slides.push(newSlide);

    return this;
  }

  /**
   * WIP: copy and modify a master from template to output
   * @param name
   * @param masterNumber
   * @param callback
   */
  public addMaster(
    name: string,
    masterNumber: number,
    callback?: (slide: Slide) => void,
  ): this {
    const template = this.getTemplate(name);

    const newMaster = new Master({
      presentation: this,
      template,
      masterNumber,
    });

    // this.rootTemplate.slides.push(newMaster);

    return this;
  }

  /**
   * Searches this.templates to find template by given name.
   * @internal
   * @param name Alias name if given to loaded template.
   * @returns template
   */
  public getTemplate(name: string): PresTemplate {
    const template = this.templates.find((t) => t.name === name);
    if (template === undefined) {
      throw new Error(`Template not found: ${name}`);
    }
    return template;
  }

  /**
   * Write all imports and modifications to a file.
   * @param location - Filename or path for the file. Will be prefixed with 'outputDir'
   * @returns summary object.
   */
  public async write(location: string): Promise<AutomizerSummary> {
    const rootArchive = await this.rootTemplate.archive;

    this.status.max = this.rootTemplate.slides.length;
    for (const slide of this.rootTemplate.slides) {
      await this.rootTemplate.appendSlide(slide);
    }

    const content = await rootArchive.generateAsync({ type: 'nodebuffer' });

    return FileHelper.writeOutputFile(
      this.getLocation(location, 'output'),
      content,
      this,
    );
  }

  /**
   * Applies path prefix to given location string.
   * @param location path and/or filename
   * @param [type] template or output
   * @returns location
   */
  private getLocation(location: string, type?: string): string {
    switch (type) {
      case 'template':
        if (fs.existsSync(this.templateDir + location)) {
          return this.templateDir + location;
        } else if (fs.existsSync(this.templateFallbackDir + location)) {
          return this.templateFallbackDir + location;
        }
        break;
      case 'output':
        return this.outputDir + location;
      default:
        return location;
    }
  }
}
