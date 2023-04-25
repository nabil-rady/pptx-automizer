import { vd } from './helper/general-helper';
import Automizer, { modify, ModifyTextHelper, XmlHelper } from './index';
import { XmlElement } from './types/xml-types';

// const automizer = (outputName) =>
//   new Automizer({
//     templateDir: `${__dirname}/../__tests__/pptx-templates`,
//     outputDir: `${__dirname}/../__tests__/pptx-output`,
//     // You can enable 'archiveType' and set mode: 'fs'
//     // This will extract all templates and output to disk.
//     // It will not improve performance, but it can help debugging:
//     // You don't have to manually extract pptx contents, which can
//     // be annoying if you need to look inside your files.
//     archiveType: {
//       mode: 'fs',
//       baseDir: `${__dirname}/../__tests__/pptx-cache`,
//       workDir: outputName,
//       // cleanupWorkDir: true,
//     },
//     rootTemplate: 'RootTemplate.pptx',
//     presTemplates: [`SlidesWithAdditionalMaster.pptx`],
//     removeExistingSlides: true,
//     autoImportSlideMasters: true,
//     cleanup: false,
//     compression: 0,
//   });

const run = async () => {
  const automizer = new Automizer({
    templateDir: `${__dirname}/../__tests__/pptx-templates`,
    outputDir: `${__dirname}/../__tests__/pptx-output`,
    autoImportSlideMasters: true,
  });

  const pres = await automizer
    .loadRoot(`EmptyTemplate.pptx`)
    .load('SlidesWithAdditionalMaster.pptx')

    // We can disable .addMaster according to "autoImportSlideMasters: true"
    // .addMaster('SlidesWithAdditionalMaster.pptx', 1)

    .addSlide('SlidesWithAdditionalMaster.pptx', 3, (slide) => {
      // We can also disable "slide.useSlideLayout()"
      // with "autoImportSlideMasters: true"
      // slide.useSlideLayout();
    })
    .write(`add-slide-master-auto-import.test.pptx`);
};

run().catch((error) => {
  console.error(error);
});
