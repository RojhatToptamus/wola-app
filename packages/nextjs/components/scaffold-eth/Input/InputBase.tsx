import { ChangeEvent, FocusEvent, ReactNode, useCallback, useEffect, useRef } from "react";
import { CommonInputProps } from "~~/components/scaffold-eth";

type InputBaseProps<T> = CommonInputProps<T> & {
  error?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
  reFocus?: boolean;
};

export const InputBase = <T extends { toString: () => string } | undefined = string>({
  name,
  value,
  onChange,
  placeholder,
  error,
  disabled,
  prefix,
  suffix,
  reFocus,
}: InputBaseProps<T>) => {
  const inputReft = useRef<HTMLInputElement>(null);

  let modifier = "";
  let containerModifier = "";

  if (error) {
    modifier = "border-error";
    containerModifier = "border-error";
  } else if (disabled) {
    modifier = "border-disabled bg-base-300/50";
    containerModifier = "border-base-300/30 bg-base-300/30";
  }

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value as unknown as T);
    },
    [onChange],
  );

  // Runs only when reFocus prop is passed, useful for setting the cursor
  // at the end of the input. Example AddressInput
  const onFocus = (e: FocusEvent<HTMLInputElement, Element>) => {
    if (reFocus !== undefined) {
      e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length);
    }
  };

  useEffect(() => {
    if (reFocus !== undefined && reFocus === true) inputReft.current?.focus();
  }, [reFocus]);

  return (
    <div
      className={`
        flex items-center
        border border-accent/30 
        bg-base-300/80 
        rounded-xl 
        text-base-content
        backdrop-blur-sm
        transition-all duration-200 ease-in-out
        hover:border-accent/40
        focus-within:border-base-content/40
        focus-within:bg-base-300/95
        focus-within:shadow-[0_0_0_2px_rgba(255,255,255,0.1)]
        ${containerModifier}
      `}
    >
      {prefix && <div className="flex items-center justify-center px-3 text-accent/70">{prefix}</div>}
      <input
        className={`
          flex-1
          bg-transparent
          border-none
          outline-none
          h-[2.8rem] 
          min-h-[2.8rem] 
          px-4
          font-medium
          text-base-content
          placeholder:text-accent/60
          placeholder:font-normal
          transition-all duration-200
          focus:text-base-content
          disabled:text-accent/50
          disabled:cursor-not-allowed
          ${modifier}
        `}
        placeholder={placeholder}
        name={name}
        value={value?.toString()}
        onChange={handleChange}
        disabled={disabled}
        autoComplete="off"
        ref={inputReft}
        onFocus={onFocus}
      />
      {suffix && <div className="flex items-center justify-center px-3 text-accent/70">{suffix}</div>}
    </div>
  );
};
