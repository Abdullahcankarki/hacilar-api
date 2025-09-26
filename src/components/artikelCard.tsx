import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as AiIcons from "react-icons/ai";
import { FaShoppingCart } from "react-icons/fa";
import { useAuth } from "../providers/Authcontext";
import { addKundenFavorit, removeKundenFavorit } from "../backend/api";
import fallbackImage from "../Cartzilla/assets/img/shop/grocery/10.png";
import { ArtikelPositionResource, ArtikelResource } from "../Resources";

export type Props = {
  article: ArtikelResource;
  favoriten: string[];
  setFavoriten: (ids: string[]) => void;
  cart: ArtikelPositionResource[];
  setCart: (cart: ArtikelPositionResource[]) => void;
  onAddToCart: (position: ArtikelPositionResource) => void;
  einheiten: { [id: string]: string };
  setEinheiten: (data: { [id: string]: string }) => void;
  mengen: { [id: string]: number };
  setMengen: (data: { [id: string]: number }) => void;
  zerlegung: { [id: string]: boolean };
  setZerlegung: (data: { [id: string]: boolean }) => void;
  vakuum: { [id: string]: boolean };
  setVakuum: (data: { [id: string]: boolean }) => void;
  bemerkungen: { [id: string]: string };
  setBemerkungen: (data: { [id: string]: string }) => void;
  small?: boolean;
};

// --- Helpers ---
const unitFromModus = (modus?: string) =>
  modus === "STÜCK" ? "stück" : modus === "KARTON" ? "karton" : "kg"; // fallback

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(val || 0);

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const ArtikelCard: React.FC<Props> = ({
  article,
  favoriten,
  setFavoriten,
  cart,
  setCart,
  onAddToCart,
  einheiten,
  setEinheiten,
  mengen,
  setMengen,
  zerlegung,
  setZerlegung,
  vakuum,
  setVakuum,
  bemerkungen,
  setBemerkungen,
  small,
}) => {
  const { user } = useAuth();
  const isInCart = cart.some((i) => i.artikel === article.id);
  const cartItem = cart.find((i) => i.artikel === article.id);

  const [lokaleMenge, setLokaleMenge] = useState<{ [artikelId: string]: number }>({});
  const [lokaleEinheit, setLokaleEinheit] = useState<{ [artikelId: string]: string }>({});

  // Default-Einheit aus erfassungsModus übernehmen
  useEffect(() => {
    if (!article.id) return;
    const desired = unitFromModus(article.erfassungsModus);
    setLokaleEinheit((prev) => (prev[article.id!] ? prev : { ...prev, [article.id!]: desired }));
  }, [article.id, article.erfassungsModus]);

  const toggleFavorit = async () => {
    if (!article.id) return;
    const isFav = favoriten.includes(article.id);
    try {
      if (user) {
        if (isFav) {
          await removeKundenFavorit(user.id, article.id);
          setFavoriten(favoriten.filter((f) => f !== article.id));
        } else {
          await addKundenFavorit(user.id, article.id);
          setFavoriten([...favoriten, article.id]);
        }
      } else {
        // Fallback: lokal toggeln
        setFavoriten(isFav ? favoriten.filter((f) => f !== article.id) : [...favoriten, article.id]);
      }
    } catch (e) {
      console.error("Fehler beim Favorit-Toggle", e);
    }
  };

  // Menge helpers (arbeiten je nach Zustand mit Warenkorb oder lokalem State)
  const getCurrentQty = () => (isInCart ? cartItem?.menge || 0 : lokaleMenge[article.id!] || 0);
  const setQty = (val: number) => {
    const menge = Math.max(0, Number.isFinite(val) ? val : 0);
    if (isInCart) {
      const updated = cart.map((it) => (it.artikel === article.id ? { ...it, menge } : it));
      setCart(updated);
      localStorage.setItem("warenkorb", JSON.stringify(updated));
    } else if (article.id) {
      setLokaleMenge((prev) => ({ ...prev, [article.id!]: menge }));
    }
  };

  const decQty = () => {
    const menge = getCurrentQty();
    if (isInCart) {
      if (menge > 1) {
        setQty(menge - 1);
      } else {
        const updated = cart.filter((it) => it.artikel !== article.id);
        setCart(updated);
        localStorage.setItem("warenkorb", JSON.stringify(updated));
      }
    } else {
      setQty(Math.max(0, menge - 1));
    }
  };
  const incQty = () => setQty(getCurrentQty() + 1);

  const currentUnit = () =>
    isInCart ? (cartItem?.einheit as any) : lokaleEinheit[article.id!] || unitFromModus(article.erfassungsModus);
  const setUnit = (neueEinheit: "kg" | "stück" | "kiste" | "karton") => {
    if (isInCart) {
      const updated = cart.map((it) => (it.artikel === article.id ? { ...it, einheit: neueEinheit } : it));
      setCart(updated);
      localStorage.setItem("warenkorb", JSON.stringify(updated));
    } else if (article.id) {
      setLokaleEinheit((prev) => ({ ...prev, [article.id!]: neueEinheit }));
    }
  };

  const handleAddToCart = () => {
    const menge = getCurrentQty();
    if (menge < 1 || !article.id) return;
    const einheit = currentUnit();

    const position: ArtikelPositionResource = {
      artikel: article.id,
      artikelName: article.name,
      menge,
      einheit: einheit as any,
      einzelpreis: article.preis,
      gesamtpreis: round2((article.preis || 0) * menge),
      zerlegung: !!zerlegung[article.id],
      vakuum: !!vakuum[article.id],
      bemerkung: bemerkungen[article.id] || "",
    } as any;

    onAddToCart(position);
    // Optional: lokal zurücksetzen
    setLokaleMenge((prev) => ({ ...prev, [article.id!]: 0 }));
  };

  return (
    <div className="col">
      <div className="card border-0 shadow-sm h-100 position-relative rounded-4 overflow-hidden">
        {/* Bild (Hover-Transition im Cartzilla-Stil) */}
        <Link className="hover-effect-opacity ratio ratio-4x3 d-block" to={`/artikel/${article.id}`}>
          <img
            src={article.bildUrl || fallbackImage}
            className="hover-effect-target opacity-100 w-100 h-100 object-fit-cover"
            alt={article.name}
            loading="lazy"
          />
          <img
            src={article.bildUrl || fallbackImage}
            className="position-absolute top-0 start-0 hover-effect-target opacity-0 w-100 h-100 object-fit-cover rounded-4"
            alt={`${article.name} Hover`}
            loading="lazy"
          />
        </Link>

        {/* Body */}
        <div className="card-body d-flex flex-column gap-2">
          {small ? (
            <div className="d-flex flex-column gap-1 mb-1 name-row">
              <Link className="d-block fw-medium name-wrap text-dark text-decoration-none" to={`/artikel/${article.id}`}>
                <span>{article.name}</span>
              </Link>
              <span className="fw-medium text-dark">{formatCurrency(article.preis)}</span>
            </div>
          ) : (
            <div className="d-flex align-items-start justify-content-between gap-2 mb-1 name-row">
              <Link className="d-block fw-medium name-wrap text-dark text-decoration-none" to={`/artikel/${article.id}`}>
                <span>{article.name}</span>
              </Link>
              <span className="fw-medium text-dark">{formatCurrency(article.preis)}</span>
            </div>
          )}

          {article.ausverkauft && (
            <span className="badge bg-danger align-self-start">Ausverkauft</span>
          )}

          {!article.ausverkauft && (
            <>
              {/* Menge + Plus/Minus */}
              <div className="d-flex gap-2 w-100">
                {small ? (
                  <input
                    type="text"
                    value={getCurrentQty() ? String(getCurrentQty()) : ""}
                    className="form-control form-control-sm text-center border-1 no-spinner"
                    onChange={(e) => {
                      const val = e.target.value;
                      const num = parseInt(val);
                      const neueMenge = val === "" ? 0 : isNaN(num) ? 1 : num;
                      setQty(neueMenge);
                    }}
                  />
                ) : (
                  <>
                    <button
                      className="btn btn-outline-secondary rounded-pill px-3"
                      type="button"
                      onClick={decQty}
                      aria-label="Menge verringern"
                    >
                      <i className="ci-minus" />
                    </button>

                    <input
                      type="text"
                      value={getCurrentQty() ? String(getCurrentQty()) : ""}
                      className="form-control form-control-sm text-center border-1 no-spinner"
                      onChange={(e) => {
                        const val = e.target.value;
                        const num = parseInt(val);
                        const neueMenge = val === "" ? 0 : isNaN(num) ? 1 : num;
                        setQty(neueMenge);
                      }}
                    />

                    <button
                      className="btn btn-outline-secondary rounded-pill px-3"
                      type="button"
                      onClick={incQty}
                      aria-label="Menge erhöhen"
                    >
                      <i className="ci-plus" />
                    </button>
                  </>
                )}
              </div>

              {/* Einheit */}
              <select
                className="form-select form-select-sm text-center border-0 no-spinner"
                style={{ backgroundColor: "#f0f2f5" }}
                value={currentUnit()}
                onChange={(e) => setUnit(e.target.value as any)}
              >
                <option value="kg">Kg</option>
                <option value="stück">Stück</option>
                <option value="kiste">Kiste</option>
                <option value="karton">Karton</option>
              </select>

              {/* Footer: Neue CTA-Buttons */}
              <div className="d-flex align-items-center mt-2 gap-3 flex-nowrap justify-content-between">
                {isInCart ? (
                  <button
                    className="btn btn-lift btn-cart remove"
                    onClick={() => {
                      const updated = cart.filter((it) => it.artikel !== article.id);
                      setCart(updated);
                      localStorage.setItem('warenkorb', JSON.stringify(updated));
                    }}
                    aria-label="Aus dem Warenkorb entfernen"
                  >
                    <AiIcons.AiOutlineClose />
                  </button>
                ) : (
                  <button
                    className="btn btn-lift btn-cart"
                    onClick={handleAddToCart}
                    aria-label="In den Warenkorb"
                  >
                    <FaShoppingCart />
                  </button>
                )}

                <button
                  type="button"
                  className={`btn btn-lift btn-fav ${favoriten.includes(article.id || '') ? 'active' : ''}`}
                  onClick={toggleFavorit}
                  aria-label="Favorit"
                >
                  {favoriten.includes(article.id || '') ? (
                    <AiIcons.AiFillHeart />
                  ) : (
                    <AiIcons.AiOutlineHeart />
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Styling tweaks */}
      <style>{`
        .no-spinner::-webkit-outer-spin-button, .no-spinner::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .no-spinner { -moz-appearance: textfield; }
        .object-fit-cover { object-fit: cover; }
        .btn-lift { 
          display: inline-flex; align-items: center; gap: .5rem;
          border: 0; border-radius: 999px; padding: .5rem 1rem;
          box-shadow: 0 .5rem 1rem rgba(0,0,0,.06);
          transition: transform .15s ease, box-shadow .15s ease, background-color .2s;
          font-weight: 600;
        }
        .btn-lift:hover { transform: translateY(-1px); box-shadow: 0 .75rem 1.5rem rgba(0,0,0,.08); }
        .btn-cart { background: linear-gradient(180deg, var(--bs-primary), var(--bs-primary)); color: #fff; }
        .btn-fav { background: #f3f4f6; color: #555; }
        .btn-fav.active { background: #ffe9ec; color: #dc3545; }
        .btn-fav:hover { background: #eceff3; }
        .btn-cart, .btn-fav { flex: 1; justify-content: center; }

        /* Remove-from-cart state: red */
        .btn-cart.remove { background: var(--bs-danger); color: #fff; }
        .btn-cart.remove:hover { transform: none; box-shadow: 0 .5rem 1rem rgba(220,53,69,.25); }

        /* Normalize header height and clamp long names to 2 lines */
        .name-row { min-height: 3.2rem; }
        .name-wrap { white-space: normal; line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>
    </div>
  );
};

export default ArtikelCard;
