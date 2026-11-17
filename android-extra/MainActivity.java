package com.valkyrcita.plotsanddots;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(Descargas.class);
        super.onCreate(savedInstanceState);
    }
}
