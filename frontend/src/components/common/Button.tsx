import { CommandBarButton, DefaultButton, IButtonProps, IButtonStyles, ICommandBarStyles } from "@fluentui/react";
import { IS_DB_AVAILABLE } from "../../api/authConfig";

interface ShareButtonProps extends IButtonProps {
  onClick: () => void;
}

export const ShareButton: React.FC<ShareButtonProps> = ({ onClick, action }) => {
  const shareButtonStyles: ICommandBarStyles & IButtonStyles = {
    root: {
      width: 86,
      height: 32,
      borderRadius: 4,
      background: '#FFFFFF',
      padding: '5px 10px',
      marginRight: IS_DB_AVAILABLE ? '7px' : '21px',
      color: '#323130',
      border: '0.5px solid rgb(49 125 176)'
    },
    icon: {
      color: 'rgb(49 125 176)'
    },
    rootHovered: {
      background: '#FFFFFF',
    },
    label: {
      fontWeight: 600,
      fontSize: 14,
      lineHeight: '20px',
      color: 'rgb(49 125 176)'
    },
  };

  return (
    <CommandBarButton
      styles={shareButtonStyles}
      iconProps={{ iconName: 'Share' }}
      onClick={onClick}
      text="Share"
    />
  )
}

interface HistoryButtonProps extends IButtonProps {
  onClick: () => void;
  text: string;
}

export const HistoryButton: React.FC<HistoryButtonProps> = ({ onClick, text }) => {

  const shareButtonStyles: ICommandBarStyles & IButtonStyles = {
    root: {
      width: 180,
      height: 32,
      borderRadius: 4,
      background: 'radial-gradient(109.81% 107.82% at 100.1% 90.19%, #0F6CBD 33.63%, #2D87C3 70.31%, #8DDDD8 100%)',
      padding: '5px 10px',
      marginRight: '10px',
      color: '#FFFFFF',
    },
    icon: {
      color: '#FFFFFF',
    },
    rootHovered: {
    },
    label: {
      fontWeight: 600,
      fontSize: 14,
      lineHeight: '20px',
      color: '#FFFFFF',

    },
  };

  return (
    <DefaultButton
      text={text}
      primary
      iconProps={{ iconName: '' }}
      onClick={onClick}
      styles={shareButtonStyles}
    />
  )
}