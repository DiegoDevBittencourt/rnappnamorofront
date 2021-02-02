import React from 'react';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';

import * as Actions from '../../../../actions';
import { GenericRowView, GenericColumnView, P } from '../../../../GlobalStyle';
import { GenericAppButton } from '../../../commonComponents';
import { handleError } from '../../../utils/Functions';

export const PCustom = styled(P)`
    margin-top: 10px;
    text-align: center;
`;

export default function GenericYesNoModalContent(props) {

    const { subtitle, acceptText, denyText, selectedMethod, selectedUserImageId, matchedProfile } = props.route.params;

    const dispatch = useDispatch();

    const customButtonStyle = {
        flex: 1,
        margin: 10,
        marginTop: 40,
        width: 'auto',
    }

    const handleClose = () => props.navigation.goBack();

    const acceptMethod = () => {
        try {
            switch (selectedMethod) {
                case 'genericYesNoModalDeleteAccount':
                    handleClose();
                    dispatch(Actions.deleteAccount());
                    break;
                case 'genericYesNoModalUnmatch':
                    dispatch(Actions.unmatch(matchedProfile?.id));
                    break;
                case 'genericYesNoModalDeleteUserImage':
                    dispatch(Actions.deleteUserImage(selectedUserImageId));
                    break;
                default:
                    break;
            }
        } catch (error) {
            handleError(error);
        }
    }

    return <GenericColumnView>

        <PCustom>{subtitle}</PCustom>

        <GenericRowView>
            <GenericAppButton
                customButtonStyle={customButtonStyle}
                textButton={denyText.toUpperCase()}
                onPress={handleClose}
            />

            <GenericAppButton
                customButtonStyle={customButtonStyle}
                textButton={acceptText.toUpperCase()}
                onPress={acceptMethod}
            />
        </GenericRowView>

    </GenericColumnView>
}
