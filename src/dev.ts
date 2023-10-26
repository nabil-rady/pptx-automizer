import Automizer from './index';
import pptxgen from 'pptxgenjs';

const run = async () => {
  const outputDir = `${__dirname}/../__tests__/pptx-output`;
  const templateDir = `${__dirname}/../__tests__/pptx-templates`;

  let presPptxGen = new pptxgen();

  let slide = presPptxGen.addSlide();
  let textboxText = 'Hello World from PptxGenJS!';
  let textboxOpts: pptxgen.TextPropsOptions = {
    x: 1,
    y: 1,
    color: '363636',
    objectName: 'Text 1',
  };
  slide.addText(textboxText, textboxOpts);
  slide.addImage({
    path: 'https://upload.wikimedia.org/wikipedia/en/a/a9/Example.jpg',
    objectName: 'Image 1',
    x: 1,
    y: 2,
  });

  await presPptxGen.writeFile({
    fileName: templateDir + '/presPptxGenTmp.pptx',
  });

  const automizer = new Automizer({
    templateDir,
    outputDir,
    removeExistingSlides: true,
  });

  let pres = automizer
    .loadRoot(`RootTemplate.pptx`)
    .load(`presPptxGenTmp.pptx`, 'presPptxGenTmp')
    .load(`SlideWithShapes.pptx`, 'shapes');

  pres.addSlide('shapes', 1, (slide) => {
    slide.addElement('presPptxGenTmp', 1, 'Text 1');
    slide.addElement('presPptxGenTmp', 1, 'Image 1');
  });

  pres.write(`myOutputPresentation.pptx`).then((summary) => {
    console.log(summary);
  });
};

run().catch((error) => {
  console.error(error);
});
