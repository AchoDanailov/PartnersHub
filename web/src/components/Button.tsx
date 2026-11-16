import type { ComponentProps } from 'react'
import { Link, type LinkProps } from 'react-router'
import { buttonClass, type Size, type Variant } from './buttonClass'

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}: ComponentProps<'button'> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, className, size)} {...props} />
}

export function ButtonLink({
  variant = 'primary',
  className = '',
  ...props
}: LinkProps & { variant?: Variant }) {
  return <Link className={buttonClass(variant, className)} {...props} />
}
