function Button({
  children,
  variant = "primary",
  type = "button",
  onClick,
  disabled = false,
  className = "",
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`ui-button ui-button-${variant} ${className}`.trim()}
    >
      {children}
    </button>
  );
}

export default Button;