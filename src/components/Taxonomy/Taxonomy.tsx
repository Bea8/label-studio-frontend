import React, { FormEvent, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { useToggle } from "../../hooks/useToggle";
import { isArraysEqual } from "../../utils/utilities";
import { LsChevron } from "../../assets/icons";

import styles from "./Taxonomy.module.scss";

type TaxonomyPath = string[]
type onAddLabelCallback = (label: string[]) => any

type TaxonomyItem = {
  label: string,
  path: TaxonomyPath,
  depth: number,
  children?: TaxonomyItem[],
  custom?: boolean,
}

type TaxonomyOptions = {
  leafsOnly?: boolean,
  showFullPath?: boolean,
  pathSeparator?: string,
  maxUsages?: number,
  placeholder?: string,
}

type TaxonomyOptionsContextValue = TaxonomyOptions & {
  maxUsagesReached?: boolean,
}

type TaxonomyProps = {
  items: TaxonomyItem[],
  selected: TaxonomyPath[],
  onChange: (node: any, selected: TaxonomyPath[]) => any,
  onAddLabel: onAddLabelCallback,
  options?: TaxonomyOptions,
}

type TaxonomySelectedContextValue = [
  TaxonomyPath[],
  (path: TaxonomyPath, value: boolean) => any,
]

const TaxonomySelectedContext = React.createContext<TaxonomySelectedContextValue>([[], () => undefined]);
const TaxonomyOptionsContext = React.createContext<TaxonomyOptionsContextValue>({});

const SelectedList = () => {
  const [selected, setSelected] = useContext(TaxonomySelectedContext);
  const { showFullPath, pathSeparator = " / " } = useContext(TaxonomyOptionsContext);

  return (
    <div className={styles.taxonomy__selected}>
      {selected.map(path => (
        <div key={path.join("|")}>
          {showFullPath ? path.join(pathSeparator) : path[path.length - 1]}
          <input type="button" onClick={() => setSelected(path, false)} value="×" />
        </div>
      ))}
    </div>
  );
};

// check if item is child of parent (i.e. parent is leading subset of item)
function isSubArray(item: string[], parent: string[]) {
  if (item.length <= parent.length) return false;
  return parent.every((n, i) => item[i] === n);
}

const Item = ({ item, flat }: { item: TaxonomyItem, flat?: boolean }) => {
  const [selected, setSelected] = useContext(TaxonomySelectedContext);
  const { leafsOnly, maxUsages, maxUsagesReached } = useContext(TaxonomyOptionsContext);

  const checked = selected.some(current => isArraysEqual(current, item.path));
  const isChildSelected = selected.some(current => isSubArray(current, item.path));
  const hasChilds = Boolean(item.children?.length);
  const onlyLeafsAllowed = leafsOnly && hasChilds;
  const limitReached = maxUsagesReached && !checked;
  const disabled = onlyLeafsAllowed || limitReached;

  const [isOpen, open, , toggle] = useToggle(isChildSelected || flat === false);
  const onClick = () => leafsOnly && toggle();
  const arrowStyle = item.children?.length && flat !== true
    ? { transform: isOpen ? "rotate(180deg)" : "rotate(90deg)" }
    : { display: "none" };

  useEffect(() => {
    if (isChildSelected) open();
  }, [isChildSelected]);

  useEffect(() => {
    if (flat === false) open();
  }, [flat]);

  const title = onlyLeafsAllowed
    ? "Only leaf nodes allowed"
    : (limitReached ? `Maximum ${maxUsages} items already selected` : undefined);

  const setIndeterminate = useCallback(el => {
    if (!el) return;
    if (checked) el.indeterminate = false;
    else el.indeterminate = isChildSelected;
  }, [checked, isChildSelected]);

  const customClassname = item.custom ? styles.taxonomy__item_custom : "";

  return (
    <div>
      <div className={[styles.taxonomy__item, customClassname].join(" ")}>
        <div className={styles.taxonomy__grouping} onClick={toggle}>
          <LsChevron stroke="#09f" style={arrowStyle} />
        </div>
        <label
          onClick={onClick}
          title={title}
          className={disabled ? styles.taxonomy__collapsable : undefined}
        >
          <input
            type="checkbox"
            disabled={disabled}
            checked={checked}
            ref={setIndeterminate}
            onChange={e => setSelected(item.path, e.currentTarget.checked)}
          />
          {item.label}
        </label>
      </div>
      {item.children && !flat && isOpen && item.children.map(
        child => <Item key={child.label} item={child}/>,
      )}
    </div>
  );
};

type DropdownProps = {
  dropdownRef: React.Ref<HTMLDivElement>,
  flatten: TaxonomyItem[],
  items: TaxonomyItem[],
  show: boolean,
  onAddLabel: onAddLabelCallback,
}

const filterTreeByPredicate = (
  flatten: TaxonomyItem[],
  predicate: (item: TaxonomyItem) => boolean,
) => {
  const roots: TaxonomyItem[] = [];
  const childs: TaxonomyItem[][] = [];
  let d = -1;

  for (let i = flatten.length; i--; ) {
    const item = flatten[i];

    if (item.depth === d) {
      const adjusted: TaxonomyItem = { ...item, children: childs[d] ?? [] };

      childs[d] = [];
      if (d) {
        childs[d - 1].unshift(adjusted);
      } else {
        roots.unshift(adjusted);
      }
      d--;
      continue;
    }

    if (predicate(item)) {
      const adjusted = { ...item, children: [] };

      if (item.depth === 0) {
        roots.unshift(adjusted);
      } else {
        d = item.depth - 1;
        if (!childs[d]) childs[d] = [];
        childs[d].unshift(adjusted);
      }
    }
  }

  return roots;
};

const Dropdown = ({ show, flatten, items, dropdownRef, onAddLabel }: DropdownProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const predicate = (item: TaxonomyItem) => item.label.toLocaleLowerCase().includes(search);
  const onInput = (e: FormEvent<HTMLInputElement>) => setSearch(e.currentTarget.value.toLocaleLowerCase());

  const list = search ? filterTreeByPredicate(flatten, predicate) : items;

  const addRef = useRef<HTMLInputElement>(null);
  const onAdd = e => {
    if (!addRef.current) return;

    const value = addRef.current.value;

    if (e.target.type === "button" || e.key === "Enter") {
      onAddLabel([value]);
      addRef.current.value = "";
    }
  };

  useEffect(() => {
    const input = inputRef.current;

    if (show && input) {
      input.value = "";
      input.focus();
      setSearch("");
    }
  }, [show]);

  return (
    <div className={styles.taxonomy__dropdown} ref={dropdownRef} style={{ display: show ? "block" : "none" }}>
      <input
        autoComplete="off"
        className={styles.taxonomy__search}
        name="taxonomy__search"
        placeholder="Search..."
        onInput={onInput}
        ref={inputRef}
      />
      {/* <div style={{ display: "flex" }}>
        <input name="taxonomy__add" onKeyPress={onAdd} ref={addRef} />
        <button onClick={onAdd} type="button">Add</button>
      </div> */}
      {list.map(item => <Item key={item.label} item={item} flat={search === "" ? undefined : false} />)}
    </div>
  );
};

const Taxonomy = ({ items, selected: externalSelected, onChange, onAddLabel, options = {} }: TaxonomyProps) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const taxonomyRef = useRef<HTMLDivElement>(null);
  const [isOpen, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const onClickOutside = useCallback(e => {
    if (!taxonomyRef.current?.contains(e.target)) close();
  }, []);
  const onEsc = useCallback(e => {
    if (e.key === "Escape") {
      close();
      e.stopPropagation();
    }
  }, []);

  const isOpenClassName = isOpen ? styles.taxonomy_open : "";

  const flatten = useMemo(() => {
    const flatten: TaxonomyItem[] = [];
    const visitItem = (item: TaxonomyItem) => {
      flatten.push(item);
      item.children?.forEach(visitItem);
    };

    items.forEach(visitItem);
    return flatten;
  }, [items]);

  const [selected, setInternalSelected] = useState(externalSelected);
  const contextValue: TaxonomySelectedContextValue = useMemo(() => {
    const setSelected = (path: TaxonomyPath, value: boolean) => {
      const newSelected = value
        ? [...selected, path]
        : selected.filter(current => !isArraysEqual(current, path));

      setInternalSelected(newSelected);
      onChange && onChange(null, newSelected);
    };

    return [selected, setSelected];
  }, [selected]);

  const optionsWithMaxUsages = useMemo(() => {
    const maxUsagesReached = options.maxUsages ? selected.length >= options.maxUsages : false;

    return { ...options, maxUsagesReached };
  }, [options, options.maxUsages, options.maxUsages ? selected : 0]);

  useEffect(() => {
    setInternalSelected(externalSelected);
  }, [externalSelected]);

  useEffect(() => {
    if (isOpen) {
      document.body.addEventListener("click", onClickOutside, true);
      document.body.addEventListener("keydown", onEsc, true);
    } else {
      document.body.removeEventListener("click", onClickOutside);
      document.body.removeEventListener("keydown", onEsc);
    }
  }, [isOpen]);

  return (
    <TaxonomySelectedContext.Provider value={contextValue}>
      <TaxonomyOptionsContext.Provider value={optionsWithMaxUsages}>
        <SelectedList />
        <div className={[styles.taxonomy, isOpenClassName].join(" ")} ref={taxonomyRef}>
          <span onClick={() => setOpen(val => !val)}>
            {options.placeholder || "Click to add..."}
            <LsChevron stroke="#09f" />
          </span>
          <Dropdown show={isOpen} items={items} flatten={flatten} dropdownRef={dropdownRef} onAddLabel={onAddLabel} />
        </div>
      </TaxonomyOptionsContext.Provider>
    </TaxonomySelectedContext.Provider>
  );
};

export { Taxonomy };
