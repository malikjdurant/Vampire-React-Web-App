const { useState, useEffect, useRef } = React;

const clientID = "t-FQWYk2PUt13LidWIblzu7SNd9HVOQsK3QA7Lg1Mg4";
const utm = "?utm_source=scrimba_degree&utm_medium=referral";

const loadData = (options) => {
  fetch(options.url)
    .then((r) => r.json())
    .then((data) => options.onSuccess && options.onSuccess(data))
    .catch((err) => {
      console.error("Failed to load photos:", err);
      if (options.onError) options.onError(err);
    });
};

function useAmbientPad() {
  // returns {isPlaying, toggle}
  const ctxRef = useRef(null);
  const nodesRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    return () => {
      // cleanup on unmount
      if (ctxRef.current) ctxRef.current.close();
    };
  }, []);

  const toggle = () => {
    if (!isPlaying) {
      // start synth
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      ctxRef.current = ctx;

      // master gain with gentle fade
      const master = ctx.createGain();
      master.gain.value = 0.0;
      master.connect(ctx.destination);

      // slow LFO for subtle movement
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 0.05; // very slow
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.15;

      // two detuned oscillators for warm pad
      const oscA = ctx.createOscillator();
      const oscB = ctx.createOscillator();
      oscA.type = "triangle";
      oscB.type = "triangle";
      oscA.frequency.value = 110; // low A
      oscB.frequency.value = 110 * 1.012; // slight detune

      // lowpass filter to make it warm and dark
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 700;

      // gentle reverb-like effect using delay + feedback
      const delay = ctx.createDelay();
      delay.delayTime.value = 0.6;
      const fb = ctx.createGain();
      fb.gain.value = 0.35;
      delay.connect(fb);
      fb.connect(delay);

      // connect chain: oscs -> lp -> master and delay -> master
      oscA.connect(lp);
      oscB.connect(lp);
      lp.connect(master);
      lp.connect(delay);
      delay.connect(master);

      // lfo modulates filter cutoff
      lfo.connect(lfoGain);
      lfoGain.connect(lp.frequency);

      // ramp master gain up
      master.gain.linearRampToValueAtTime(0.0001, ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 2.0);

      // start nodes
      oscA.start();
      oscB.start();
      lfo.start();

      nodesRef.current = { ctx, master, oscA, oscB, lfo, lp, delay, fb };
      setIsPlaying(true);
    } else {
      // stop with fade out
      const nodes = nodesRef.current;
      if (!nodes) {
        setIsPlaying(false);
        return;
      }
      const { ctx, master, oscA, oscB, lfo } = nodes;
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0.0001, now + 1.5);
      // stop oscillators and close context after fade
      setTimeout(() => {
        try {
          oscA.stop();
          oscB.stop();
          lfo.stop();
        } catch (e) {}
        try {
          ctx.close();
        } catch (e) {}
        ctxRef.current = null;
        nodesRef.current = null;
      }, 1700);
      setIsPlaying(false);
    }
  };

  return { isPlaying, toggle };
}

const App = (props) => {
  const [photos, setPhotos] = useState([]);
  const [query, setQuery] = useState("vampires");
  const queryInput = useRef(null);
  const numberOfPhotos = 18;
  const urlBase = `https://api.unsplash.com/photos/random/?count=${numberOfPhotos}&client_id=${clientID}`;

  const { isPlaying, toggle } = useAmbientPad();

  useEffect(() => {
    const photosUrl = query ? `${urlBase}&query=${encodeURIComponent(query)}` : urlBase;
    loadData({
      url: photosUrl,
      onSuccess: (res) => {
        // Unsplash returns an array for random endpoint
        setPhotos(Array.isArray(res) ? res : []);
        // small scroll to top so hero is visible after search
        window.scrollTo({ top: 0, behavior: "smooth" });
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const searchPhotos = (e) => {
    e.preventDefault();
    const val = queryInput.current.value.trim();
    if (val) setQuery(val);
  };

  // micro-parallax: store pointer positions for small transform
  const handlePointer = (e, id) => {
    // element-relative small translate
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const mx = (e.clientX - (rect.left + rect.width / 2)) / rect.width;
    const my = (e.clientY - (rect.top + rect.height / 2)) / rect.height;
    const img = el.querySelector("img");
    if (img) {
      const tx = mx * 8; // px
      const ty = my * 8;
      img.style.transform = `translate(${tx}px, ${ty}px) scale(1.03) rotate(${mx * 2}deg)`;
      img.style.transition = "transform 0.12s linear";
    }
  };
  const handlePointerLeave = (e) => {
    const img = e.currentTarget.querySelector("img");
    if (img) {
      img.style.transform = "";
      img.style.transition = "transform 0.45s cubic-bezier(.2,.9,.3,1)";
    }
  };

  return (
    <div className="cinema-root">
      <div className="fog"></div>

      <header className="hero">
        <div className="hero-inner">
          <h1 className="neon">{props.emoji} {props.name}</h1>
          <p className="tagline">Enter the shadows of creativity — a gallery summoned from the gloom.</p>

          <form className="search" onSubmit={searchPhotos}>
            <input ref={queryInput} defaultValue={query} placeholder="Search the darkness (e.g. vampires, gothic, moonlight)" />
            <button type="submit" className="btn">Summon</button>
            <button type="button" className={"btn mute " + (isPlaying ? "active" : "")} onClick={toggle}>
              {isPlaying ? "Mute" : "Play Ambience"}
            </button>
          </form>
        </div>
      </header>

      <main className="gallery">
        <div className="grid">
          {photos.length === 0 && <div className="empty">Summoning images…</div>}
          {photos.map(photo => (
            <article
              key={photo.id}
              className="item"
              onMouseMove={(e) => handlePointer(e, photo.id)}
              onPointerMove={(e) => handlePointer(e, photo.id)}
              onMouseLeave={handlePointerLeave}
              onPointerLeave={handlePointerLeave}
            >
              <img className="img" src={photo.urls.regular} alt={photo.alt_description || "Unsplash image"} />
              <div className="caption">
                <div className="meta">
                  <a href={photo.user.links.html + utm} target="_blank" rel="noopener noreferrer">{photo.user.name}</a>
                  <span> • </span>
                  <a href={"https://unsplash.com" + utm} target="_blank" rel="noopener noreferrer">Unsplash</a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>

      <footer className="site-footer">
        <small>Made by {props.name} • Cinematic Gallery</small>
      </footer>
    </div>
  );
};

ReactDOM.render(<App name="Malik" emoji="🧛‍♂️" />, document.getElementById("root"));
