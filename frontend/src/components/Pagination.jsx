import React, { useState, useEffect } from "react";
import styles from "./Pagination.module.css";

const getPageNumbers = (current, total) => {
  const delta = 1;
  const range = [];
  const rangeWithDots = [];
  let l;

  for (let i = 1; i <= total; i++) {
    if (
      i === 1 ||
      i === total ||
      (i >= current - delta && i <= current + delta)
    ) {
      range.push(i);
    }
  }

  for (let i of range) {
    if (l) {
      if (i - l === 2) {
        rangeWithDots.push(l + 1);
      } else if (i - l !== 1) {
        rangeWithDots.push("...");
      }
    }
    rangeWithDots.push(i);
    l = i;
  }

  return rangeWithDots;
};

const Pagination = ({ page, totalPages, total, pageSize, onPage, disabled }) => {
  const [input, setInput] = useState(String(page));

  useEffect(() => {
    setInput(String(page));
  }, [page]);

  const start = total > 0 ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, total);

  const go = (p) => {
    if (disabled) return;
    if (p < 1 || p > totalPages || p === page) return;
    onPage(p);
  };

  const handleGo = () => {
    const n = parseInt(input, 10);
    if (!isNaN(n) && n >= 1 && n <= totalPages) {
      go(n);
    } else {
      setInput(String(page));
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter") handleGo();
  };

  if (totalPages <= 1) {
    return (
      <div className={styles.pagination}>
        <span className={styles.info}>
          Показано <strong>{total}</strong>{" "}
          {total === 1 ? "запись" : total < 5 ? "записи" : "записей"}
        </span>
      </div>
    );
  }

  const pages = getPageNumbers(page, totalPages);

  return (
    <div className={styles.pagination}>
      <span className={styles.info}>
        Записи <strong>{start}</strong>–<strong>{end}</strong> из{" "}
        <strong>{total}</strong>
      </span>

      <div className={styles.controls}>
        <button
          className={styles.navBtn}
          onClick={() => go(page - 1)}
          disabled={disabled || page <= 1}
          title="Предыдущая страница"
        >
          ←
        </button>

        <div className={styles.pageList}>
          {pages.map((p, i) =>
            p === "..." ? (
              <span key={`dots-${i}`} className={styles.ellipsis}>
                …
              </span>
            ) : (
              <button
                key={p}
                className={`${styles.pageBtn} ${
                  p === page ? styles.active : ""
                }`}
                onClick={() => go(p)}
                disabled={disabled}
              >
                {p}
              </button>
            )
          )}
        </div>

        <button
          className={styles.navBtn}
          onClick={() => go(page + 1)}
          disabled={disabled || page >= totalPages}
          title="Следующая страница"
        >
          →
        </button>
      </div>

      <div className={styles.goto}>
        <span>Перейти:</span>
        <input
          className={styles.gotoInput}
          type="number"
          min={1}
          max={totalPages}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={disabled}
        />
        <button
          className={styles.gotoBtn}
          onClick={handleGo}
          disabled={disabled}
        >
          OK
        </button>
      </div>
    </div>
  );
};

export default Pagination;