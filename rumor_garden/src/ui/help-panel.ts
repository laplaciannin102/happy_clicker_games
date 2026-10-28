import { ja } from '../i18n/ja';
import { node } from './dom';

export function createHelpPanel(): HTMLElement {
  const panel = node('section', '', 'panel help-panel');
  panel.append(node('h2', ja.helpTitle), node('p', ja.helpIntro));
  for (const section of ja.helpSections) {
    const article = node('section'); article.append(node('h3',section.title));
    const list=node('ul'); section.steps.forEach(text=>list.append(node('li',text))); article.append(list); panel.append(article);
  }
  return panel;
}
