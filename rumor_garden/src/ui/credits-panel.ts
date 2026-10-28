import { ja } from '../i18n/ja';
import { node } from './dom';

export function createCreditsPanel(): HTMLElement {
  const panel=node('section','','panel credits-panel'); panel.append(node('h2',ja.creditsTitle),node('p',ja.creditsIntro));
  const creator=node('p');
  const github=node('a',ja.creatorLink,'button-link');
  github.href='https://github.com/laplaciannin102'; github.target='_blank'; github.rel='noopener noreferrer';
  creator.append(node('span',`${ja.creatorLabel}：${ja.creatorName} `),github);
  panel.append(creator,node('h3',ja.creationTitle),node('p',ja.creationText),node('h3',ja.toolsTitle));
  const list=node('dl','','creator-roles');
  ja.creatorRoles.forEach(([role,name])=>list.append(node('dt',role),node('dd',name)));
  panel.append(list,node('p',ja.toolsText));
  return panel;
}
