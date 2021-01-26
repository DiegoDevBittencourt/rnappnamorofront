import React from 'react';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import { Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import * as Actions from '../../../../../../../../actions';
import { GenericColumnView } from '../../../../../../../../GlobalStyle';
import ControlButton from './ControlButton';
import { theme } from '../../../../../../../../constants/StyledComponentsTheme';

export default function ControlButtonsContainer() {

    const dispatch = useDispatch();
    const navigation = useNavigation();

    const handleSignOut = () => {
        dispatch(Actions.signOut());
    }

    const handleConfigButtonClick = () => {
        navigation.push('Configuration');
    }

    const handleEditInfoButtonClick = () => {
        navigation.push('EditInfo');
    }

    const ControlButtonsContainer = styled(GenericColumnView)`
        height: auto;
        width: ${Dimensions.get('window').width}px;
        flex-direction: row;
        justify-content: space-evenly;
        align-items: flex-start;
        margin-bottom: 30px;
    `;

    return <ControlButtonsContainer>

        <ControlButton
            customButtonStyle={{ backgroundColor: 'white' }}
            iconName={'cog'}
            customIconStyle={{ color: theme.$gray }}
            buttonLabel={'CONFIGURAÇÕES'}
            underlayColor={theme.$lightGray}
            onPress={handleConfigButtonClick}
        />

        <ControlButton
            customButtonStyle={{ backgroundColor: theme.$primaryColor, marginTop: 50 }}
            iconName={'sign-out-alt'}
            customIconStyle={{ color: 'white' }}
            buttonLabel={'SAIR'}
            underlayColor={theme.$darkPrimaryColor}
            onPress={handleSignOut}
        />

        <ControlButton
            customButtonStyle={{ backgroundColor: 'white' }}
            iconName={'pencil-alt'}
            customIconStyle={{ color: theme.$gray }}
            buttonLabel={'EDITAR INFO'}
            underlayColor={theme.$lightGray}
            onPress={handleEditInfoButtonClick}
        />

    </ControlButtonsContainer>
}
