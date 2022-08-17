import React, {
    useRef,
    forwardRef,
    Ref,
    useImperativeHandle,
    useEffect,
    RefObject,
    useMemo,
    useContext,
    useState,
} from 'react';
import { nextTick } from '@arco-design/mobile-utils/utils';
import { cls } from '@arco-design/mobile-utils';
import { GlobalContext } from '../context-provider';
import { SwipeActionProps, SwipeActionRef } from './type';
import RenderAction from './item';
import { getStyleWithVendor, useLatestRef, useRefState } from '../_helpers';

/**
 * 滑动操作组件，左右滑动拉出菜单栏
 * @en SwipeAction component, slide left and right to pull out the menu bar
 * @type 反馈
 * @type_en FeedBack
 * @name 滑动操作
 * @name_en SwipeAction
 */

const SwipeAction = forwardRef((props: SwipeActionProps, ref: Ref<SwipeActionRef>) => {
    const {
        className = '',
        style,
        children,
        leftActions,
        rightActions,
        disable = false,
        threshold = 0.15,
        closeOnTouchOutside,
        transitionDuration = 300,
        dampRate = 15,
        openStyleType = 'layer',
        onClose,
        onOpen,
    } = props;

    const domRef = useRef<HTMLDivElement>(null);
    const leftRef = useRef<HTMLDivElement>(null);
    const rightRef = useRef<HTMLDivElement>(null);

    const isOpen = useRef<boolean>(false);

    const leftMenuWidthRef = useRef<number>(0);
    const [leftMenuWidthArr, setLeftMenuWidthArr] = useState<number[]>([]);
    const rightMenuWidthRef = useRef<number>(0);
    const [rightMenuWidthArr, setRightMenuWidthArr] = useState<number[]>([]);
    const dampRateRef = useLatestRef(dampRate);
    const forbidClick = useRef(false);

    const [moving, movingRef, setMoving] = useRefState(false);
    const [offset, offsetRef, setOffset] = useRefState(0);
    const { prefixCls } = useContext(GlobalContext);

    const startRef = useRef(0);
    const startX = useRef(0);
    const slideX = useRef(0);
    const isLayer = openStyleType === 'layer';

    const transitionStyle = useMemo(
        () =>
            getStyleWithVendor({
                transitionDuration: moving ? '0ms' : `${transitionDuration}ms`,
            }),
        [moving, transitionDuration],
    );

    function resetMoveData() {
        startX.current = 0;
        slideX.current = 0;
    }

    function getMenuCurrentWidth(a: number, min: number, max: number): number {
        const buffer = Math.abs(a) / dampRateRef.current;
        return Math.min(Math.max(a, min - buffer), max + buffer);
    }

    function touchstart(e: TouchEvent) {
        if (!disable) {
            startRef.current = offsetRef.current;
            resetMoveData();
            startX.current = e.touches[0].pageX;
        }
    }
    function touchmove(e: TouchEvent) {
        if (disable) {
            return;
        }
        e.preventDefault();
        slideX.current = e.touches[0].pageX - startX.current;
        forbidClick.current = true;
        setMoving(true);
        /** 设置外露菜单距离 */
        setOffset(
            getMenuCurrentWidth(
                slideX.current + startRef.current,
                -rightMenuWidthRef.current,
                leftMenuWidthRef.current,
            ),
        );
    }

    function touchend() {
        if (movingRef.current) {
            const currentMenu = offsetRef.current > 0 ? 'left' : 'right';
            changeMenu(currentMenu);
            setMoving(false);
            nextTick(() => {
                forbidClick.current = false;
            });
        }
    }

    function changeMenu(dir: 'left' | 'right') {
        const cookedThreshold = isOpen.current ? 1 - threshold : threshold;
        const width = dir === 'left' ? leftMenuWidthRef.current : rightMenuWidthRef.current;
        if (width && Math.abs(offsetRef.current) > width * cookedThreshold) {
            open(dir);
        } else {
            close(dir);
        }
    }

    function getWidthByRef(widthRef: RefObject<HTMLDivElement>) {
        if (!widthRef.current) {
            return { totalWidth: 0, widthArr: [] };
        }
        let totalWidth = 0;
        const widthArr: number[] = [];
        const allEle = widthRef.current.getElementsByClassName(
            `${prefixCls}-swipe-action-menu-action-info-container`,
        );
        Array.prototype.forEach.call(allEle, (ele: HTMLElement) => {
            const w = ele.getBoundingClientRect().width ?? 0;
            totalWidth += w;
            widthArr.push(w);
        });
        return {
            totalWidth,
            widthArr,
        };
    }

    // 添加触摸事件
    useEffect(() => {
        if (disable) return;
        const container = domRef.current;
        container?.addEventListener('touchstart', touchstart);
        container?.addEventListener('touchmove', touchmove);
        container?.addEventListener('touchend', touchend);
        return () => {
            container?.removeEventListener('touchstart', touchstart);
            container?.removeEventListener('touchmove', touchmove);
            container?.removeEventListener('touchend', touchend);
        };
    }, [disable]);
    // 获取左右菜单的宽度
    useEffect(() => {
        const { totalWidth: leftTotalWidth, widthArr: leftWidthArr } = getWidthByRef(leftRef);
        leftMenuWidthRef.current = leftTotalWidth;
        setLeftMenuWidthArr(leftWidthArr);
        const { totalWidth: rightTotalWidth, widthArr: rightWidthArr } = getWidthByRef(rightRef);
        rightMenuWidthRef.current = rightTotalWidth;
        setRightMenuWidthArr(rightWidthArr);
    }, [leftActions, rightActions]);
    // closeOnTouchOutside 点击外部区域事件
    useEffect(() => {
        const handle = e => {
            if (!domRef.current?.contains(e.target)) {
                if (isOpen.current) {
                    close();
                }
            }
        };
        closeOnTouchOutside && document.addEventListener('touchstart', handle);
        return () => {
            closeOnTouchOutside && document.removeEventListener('touchstart', handle);
        };
    }, [closeOnTouchOutside]);

    useImperativeHandle(ref, () => ({
        dom: domRef.current,
        close,
        open,
    }));

    /** 关闭菜单 */
    function close(dir?: 'left' | 'right') {
        setOffset(0);
        if (isOpen.current) {
            isOpen.current = false;
            if (!dir && offsetRef.current !== 0) {
                const noDir = offsetRef.current > 0 ? 'left' : 'right';
                handleClose(noDir);
                return;
            }
            handleClose(dir);
        }
    }
    /** 打开菜单 */
    function open(dir: 'left' | 'right' = 'right') {
        if (!isOpen.current) {
            isOpen.current = true;
            handleOpen(dir);
        }
        setOffset(dir === 'left' ? leftMenuWidthRef.current : -rightMenuWidthRef.current);
    }
    /** 打开菜单后的回调 */
    function handleOpen(dir) {
        setTimeout(() => {
            onOpen?.(dir);
        }, transitionDuration);
    }
    /** 关闭菜单的回调 */
    function handleClose(dir) {
        setTimeout(() => {
            onClose?.(dir);
        }, transitionDuration);
    }

    function actionClick(e) {
        if (
            isOpen.current &&
            !forbidClick.current &&
            !leftRef.current?.contains(e.target) &&
            !rightRef.current?.contains(e.target)
        ) {
            close();
        }
    }

    function getActionRightByIndex(index: number) {
        const preWidth = leftMenuWidthArr.slice(index + 1).reduce((acc, cur) => acc + cur, 0);
        return `${(preWidth / leftMenuWidthRef.current || 0) * 100}%`;
    }

    function getActionLeftByIndex(index: number) {
        const preWidth = rightMenuWidthArr.slice(0, index).reduce((acc, cur) => acc + cur, 0);
        return `${(preWidth / rightMenuWidthRef.current || 0) * 100}%`;
    }

    return (
        <div
            className={cls(
                `${prefixCls}-swipe-action`,
                className,
                offset === 0 ? 'action-close' : 'action-open',
            )}
            style={getStyleWithVendor({
                ...(style || {}),
                ...transitionStyle,
                transform: `translateX(${offset}px)`,
            })}
            ref={domRef}
            onClick={actionClick}
        >
            <div
                className={cls(
                    `${prefixCls}-swipe-action-menu-left`,
                    `${prefixCls}-swipe-action-menu`,
                    offset > 0 ? 'action-open' : 'action-close',
                )}
                ref={leftRef}
                style={isLayer && offset >= 0 ? { width: offset, ...transitionStyle } : {}}
            >
                {leftActions?.map((action, index) => (
                    <RenderAction
                        action={{
                            ...(action || {}),
                            style: {
                                ...(isLayer ? { right: getActionRightByIndex(index) } : {}),
                                ...(action.style || {}),
                            },
                            className: cls(action.className, `open-style-${openStyleType}`),
                        }}
                        prefixCls={`${prefixCls}-swipe-action-menu-action`}
                        index={leftActions.length - index}
                        type="left"
                        close={close}
                        key={index}
                    />
                ))}
            </div>

            <div className={`${prefixCls}-swipe-action-content`}>{children}</div>

            <div
                className={cls(
                    `${prefixCls}-swipe-action-menu-right`,
                    `${prefixCls}-swipe-action-menu`,
                    offset < 0 ? 'action-open' : 'action-close',
                )}
                ref={rightRef}
                style={isLayer && offset <= 0 ? { width: -1 * offset, ...transitionStyle } : {}}
            >
                {rightActions?.map((action, index) => (
                    <RenderAction
                        action={{
                            ...(action || {}),
                            style: {
                                ...(isLayer ? { left: getActionLeftByIndex(index) } : {}),
                                ...(action.style || {}),
                            },
                            className: cls(action.className, `open-style-${openStyleType}`),
                        }}
                        prefixCls={`${prefixCls}-swipe-action-menu-action`}
                        index={index + 1}
                        type="right"
                        close={close}
                        key={index}
                    />
                ))}
            </div>
        </div>
    );
});

export default SwipeAction;