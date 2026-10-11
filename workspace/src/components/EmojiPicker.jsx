import { useMemo, useState } from 'react';

// [emoji, searchable keywords]
const GROUPS = {
  Smileys: [
    ['😀', 'grin happy'], ['😃', 'smile'], ['😄', 'smile laugh'], ['😁', 'beam'], ['😆', 'laugh'], ['😅', 'sweat'], ['😂', 'joy tears'], ['🙂', 'slight smile'],
    ['😉', 'wink'], ['😊', 'blush'], ['😍', 'love heart eyes'], ['🤩', 'star struck'], ['😎', 'cool sunglasses'], ['🤔', 'think'], ['😴', 'sleep'], ['😭', 'cry'],
    ['😡', 'angry'], ['🥳', 'party'], ['🤯', 'mind blown'], ['😇', 'angel'], ['🤗', 'hug'], ['🙃', 'upside down'], ['😬', 'grimace'], ['🥺', 'pleading'],
  ],
  People: [
    ['👋', 'wave hello'], ['👍', 'thumbs up yes'], ['👎', 'thumbs down'], ['👏', 'clap'], ['🙌', 'raised hands'], ['🙏', 'pray thanks'], ['💪', 'muscle strong'], ['🤝', 'handshake'],
    ['✌️', 'peace'], ['👀', 'eyes'], ['🧠', 'brain'], ['👤', 'person user'], ['👥', 'people team'], ['🧑‍💻', 'developer coder'], ['🧑‍🎨', 'artist'], ['🧑‍🔬', 'scientist'],
  ],
  Nature: [
    ['🌱', 'seedling plant'], ['🌳', 'tree'], ['🌲', 'evergreen'], ['🌴', 'palm'], ['🌵', 'cactus'], ['🌸', 'blossom flower'], ['🌻', 'sunflower'], ['🍀', 'clover luck'],
    ['🍁', 'maple leaf autumn'], ['🌈', 'rainbow'], ['☀️', 'sun'], ['🌙', 'moon'], ['⭐', 'star'], ['🌟', 'glowing star'], ['⚡', 'lightning'], ['🔥', 'fire hot'],
    ['💧', 'water drop'], ['❄️', 'snow'], ['🌊', 'wave ocean'], ['🐶', 'dog'], ['🐱', 'cat'], ['🦊', 'fox'], ['🐼', 'panda'], ['🦄', 'unicorn'], ['🐝', 'bee'], ['🦋', 'butterfly'],
  ],
  Food: [
    ['🍎', 'apple'], ['🍌', 'banana'], ['🍓', 'strawberry'], ['🍕', 'pizza'], ['🍔', 'burger'], ['🌮', 'taco'], ['🍣', 'sushi'], ['🍜', 'noodles ramen'],
    ['🍰', 'cake'], ['🍪', 'cookie'], ['🍩', 'donut'], ['☕', 'coffee'], ['🍵', 'tea'], ['🍷', 'wine'], ['🍺', 'beer'], ['🥗', 'salad'],
  ],
  Activity: [
    ['⚽', 'soccer football'], ['🏀', 'basketball'], ['🎾', 'tennis'], ['🏃', 'run'], ['🚴', 'bike'], ['🏋️', 'weights gym'], ['🧘', 'yoga meditate'], ['🎮', 'game controller'],
    ['🎲', 'dice'], ['🎯', 'target goal'], ['🎨', 'art paint'], ['🎬', 'movie film'], ['🎤', 'microphone'], ['🎧', 'headphones music'], ['🎸', 'guitar'], ['🎹', 'piano'],
  ],
  Travel: [
    ['🚗', 'car'], ['🚕', 'taxi'], ['🚌', 'bus'], ['🚆', 'train'], ['✈️', 'plane flight'], ['🚀', 'rocket launch'], ['🚢', 'ship'], ['🏠', 'house home'],
    ['🏢', 'office building'], ['🏖️', 'beach'], ['⛰️', 'mountain'], ['🗺️', 'map'], ['🧭', 'compass'], ['🌍', 'earth globe world'], ['🏕️', 'camping'], ['🗽', 'statue liberty'],
  ],
  Objects: [
    ['💡', 'idea light bulb'], ['📌', 'pin'], ['📎', 'paperclip'], ['📝', 'memo note write'], ['📄', 'page document'], ['📃', 'page curl'], ['📚', 'books'], ['📖', 'open book'],
    ['📓', 'notebook'], ['📒', 'ledger'], ['📅', 'calendar date'], ['🗓️', 'calendar spiral'], ['📊', 'chart bar'], ['📈', 'chart up growth'], ['📉', 'chart down'], ['📁', 'folder'],
    ['🗂️', 'dividers'], ['🗃️', 'card box'], ['🗄️', 'cabinet'], ['🔍', 'search magnify'], ['🔒', 'lock'], ['🔑', 'key'], ['🔔', 'bell'], ['📣', 'megaphone'],
    ['💻', 'laptop computer'], ['🖥️', 'desktop'], ['⌨️', 'keyboard'], ['📱', 'phone mobile'], ['🔧', 'wrench tool'], ['🛠️', 'tools'], ['⚙️', 'gear settings'], ['🧪', 'test tube lab'],
    ['💰', 'money bag'], ['💳', 'credit card'], ['🎁', 'gift'], ['🏆', 'trophy win'], ['🏷️', 'label tag'], ['📦', 'package box'], ['✉️', 'mail envelope'], ['🕐', 'clock time'],
  ],
  Symbols: [
    ['✅', 'check done'], ['☑️', 'check box'], ['❌', 'cross no'], ['⚠️', 'warning'], ['❗', 'exclamation'], ['❓', 'question'], ['💯', 'hundred'], ['✨', 'sparkles'],
    ['❤️', 'heart love red'], ['🧡', 'orange heart'], ['💛', 'yellow heart'], ['💚', 'green heart'], ['💙', 'blue heart'], ['💜', 'purple heart'], ['🖤', 'black heart'], ['🤍', 'white heart'],
    ['🔴', 'red circle'], ['🟠', 'orange circle'], ['🟡', 'yellow circle'], ['🟢', 'green circle'], ['🔵', 'blue circle'], ['🟣', 'purple circle'], ['⚫', 'black circle'], ['⚪', 'white circle'],
    ['➕', 'plus'], ['➖', 'minus'], ['➡️', 'right arrow'], ['⬆️', 'up arrow'], ['🔄', 'refresh cycle'], ['♻️', 'recycle'], ['🚩', 'flag'], ['🏁', 'finish flag'],
  ],
};

const ALL = Object.entries(GROUPS).flatMap(([group, list]) => list.map(([e, k]) => ({ e, k, group })));

export default function EmojiPicker({ onPick, onRemove, onClose, showRemove = true }) {
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return null;
    return ALL.filter((x) => x.k.includes(term) || x.group.toLowerCase().includes(term));
  }, [q]);

  const pick = (e) => { onPick(e); onClose?.(); };
  const random = () => pick(ALL[Math.floor(Math.random() * ALL.length)].e);

  return (
    <div className="emoji-picker">
      <div className="emoji-top">
        <input autoFocus placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="btn-small" onClick={random} title="Random emoji">🎲</button>
        {showRemove && <button type="button" className="btn-small" onClick={() => { onRemove?.(); onClose?.(); }}>Remove</button>}
      </div>
      <div className="emoji-scroll">
        {results ? (
          results.length ? (
            <div className="emoji-grid">
              {results.map((x) => <button key={x.e + x.k} type="button" onClick={() => pick(x.e)} title={x.k}>{x.e}</button>)}
            </div>
          ) : <div className="empty-note">No emoji found</div>
        ) : (
          Object.entries(GROUPS).map(([group, list]) => (
            <div key={group}>
              <div className="emoji-group">{group}</div>
              <div className="emoji-grid">
                {list.map(([e, k]) => <button key={e} type="button" onClick={() => pick(e)} title={k}>{e}</button>)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
